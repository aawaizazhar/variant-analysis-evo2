import os
import sys
import time

import joblib
import numpy as np
import pandas as pd
import requests
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from main import DiseaseAssociationModel


def get_hgvs(row):
    chrom = str(row["chrom"]).replace("chr", "").replace("CHR", "")
    pos = row["pos"]
    ref = str(row["ref"]).upper()
    alt = str(row["alt"]).upper()
    return f"chr{chrom}:g.{pos}{ref}>{alt}"


def build_ranker():
    return HistGradientBoostingClassifier(
        categorical_features=["chrom", "ref", "alt"],
        random_state=42,
        max_iter=200,
        early_stopping=True,
        validation_fraction=0.1,
    )


def save_confusion_matrix(y_true, y_pred, output_dir):
    labels = [0, 1]
    matrix = confusion_matrix(y_true, y_pred, labels=labels)
    matrix_df = pd.DataFrame(
        matrix,
        index=["actual_negative", "actual_positive"],
        columns=["predicted_negative", "predicted_positive"],
    )

    csv_path = os.path.join(output_dir, "snv_disease_ranker_confusion_matrix.csv")
    matrix_df.to_csv(csv_path)

    print("Validation confusion matrix:")
    print(matrix_df)
    print(f"Confusion matrix saved to {csv_path}")

    try:
        import matplotlib.pyplot as plt
        from sklearn.metrics import ConfusionMatrixDisplay

        display = ConfusionMatrixDisplay(
            confusion_matrix=matrix,
            display_labels=["Negative pair", "Positive pair"],
        )
        display.plot(cmap="Blues", values_format="d")
        plt.title("SNV Disease Ranker Confusion Matrix")
        plt.tight_layout()

        png_path = os.path.join(output_dir, "snv_disease_ranker_confusion_matrix.png")
        plt.savefig(png_path, dpi=150)
        plt.close()
        print(f"Confusion matrix plot saved to {png_path}")
    except Exception as exc:
        print(f"Could not save confusion matrix plot: {exc}")

    return matrix_df


def fetch_features_for_variants(hgvs_list, model_instance):
    fields = model_instance._myvariant_fields()
    url = "https://myvariant.info/v1/variant"
    results = {}

    # Batch size 1000
    for i in range(0, len(hgvs_list), 1000):
        chunk = hgvs_list[i : i + 1000]
        print(f"Fetching MyVariant.info for batch {i} to {i + len(chunk)}...")

        max_retries = 3
        for attempt in range(max_retries):
            try:
                resp = requests.post(
                    url, data={"ids": ",".join(chunk), "fields": fields}, timeout=30
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for hit in data:
                        if "query" in hit and not hit.get("notfound"):
                            feats = model_instance._extract_feature_values(hit)
                            results[hit["query"]] = feats
                    break
                else:
                    print(f"Error {resp.status_code}: {resp.text}")
                    time.sleep(2**attempt)
            except requests.exceptions.RequestException as e:
                print(f"Request failed: {e}. Retrying...")
                time.sleep(5)
                if attempt == max_retries - 1:
                    print("Max retries exceeded, skipping this batch.")
        time.sleep(0.5)

    return results


def main():
    print("Loading CSV dataset...")
    import os

    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, "clinvar_curated_snv_disease_lookup.csv")
    df = pd.read_csv(csv_path)

    # Filter for SNVs only (len ref == 1 and len alt == 1)
    df = df[(df["ref"].str.len() == 1) & (df["alt"].str.len() == 1)].copy()

    df["hgvs_g"] = df.apply(get_hgvs, axis=1)
    unique_hgvs = df["hgvs_g"].unique().tolist()

    print(f"Total unique SNVs: {len(unique_hgvs)}")

    # Instantiate the backend model to reuse its feature extraction logic
    model_instance = DiseaseAssociationModel()

    print("Fetching advanced features from MyVariant.info...")
    features_dict = fetch_features_for_variants(unique_hgvs, model_instance)
    print(f"Successfully retrieved features for {len(features_dict)} variants.")

    # Map features back to the dataframe
    feature_cols = [
        "CADD_phred",
        "SIFT_score",
        "Polyphen2_HDIV_score",
        "REVEL_score",
        "gnomAD_AF",
        "LRT_score",
        "PROVEAN_score",
        "phyloP100way",
        "phastCons100way",
    ]

    for col in feature_cols:
        df[col] = df["hgvs_g"].apply(
            lambda x: features_dict.get(x, {}).get(col, np.nan)
        )

    # Generate Negative Samples
    print("Generating negative samples...")
    df["label"] = 1

    neg_df = df.copy()
    neg_df["disease_name"] = np.random.permutation(neg_df["disease_name"].values)
    neg_df = neg_df[neg_df["disease_name"] != df["disease_name"]]
    neg_df["label"] = 0
    neg_df["review_score"] = 0

    # Combine
    full_df = pd.concat([df, neg_df], ignore_index=True)

    # Add existing baseline features
    full_df["is_transition"] = (
        ((full_df["ref"] == "A") & (full_df["alt"] == "G"))
        | ((full_df["ref"] == "G") & (full_df["alt"] == "A"))
        | ((full_df["ref"] == "C") & (full_df["alt"] == "T"))
        | ((full_df["ref"] == "T") & (full_df["alt"] == "C"))
    )
    full_df["is_transition"] = full_df["is_transition"].astype(int)
    full_df["position_mod_1000"] = full_df["pos"] % 1000

    print("Training the HistGradientBoostingClassifier...")

    # High-cardinality categoricals (disease_name, gene) exceed sklearn's 255 limit.
    # Hash them into 200 buckets so the model can still leverage them.
    for col in ["disease_name", "gene"]:
        full_df[col + "_hash"] = full_df[col].apply(lambda x: hash(str(x)) % 200)

    X_cols = [
        "chrom",
        "pos",
        "ref",
        "alt",
        "gene_hash",
        "disease_name_hash",
        "is_transition",
        "position_mod_1000",
    ] + feature_cols

    X = full_df[X_cols].copy()
    y = full_df["label"]

    # Only low-cardinality columns as native categoricals
    X["chrom"] = X["chrom"].astype(str).astype("category")
    X["ref"] = X["ref"].astype(str).astype("category")
    X["alt"] = X["alt"].astype(str).astype("category")

    categorical_features = ["chrom", "ref", "alt"]

    X_train, X_val, y_train, y_val = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    eval_clf = build_ranker()
    eval_clf.fit(X_train, y_train)
    y_val_pred = eval_clf.predict(X_val)

    print("Validation accuracy:", eval_clf.score(X_val, y_val))
    print("Validation classification report:")
    print(
        classification_report(
            y_val,
            y_val_pred,
            labels=[0, 1],
            target_names=["negative_pair", "positive_pair"],
            zero_division=0,
        )
    )
    save_confusion_matrix(y_val, y_val_pred, script_dir)

    # Train the final production model on all available labeled pairs.
    clf = build_ranker()
    clf.fit(X, y)
    print("Training accuracy:", clf.score(X, y))

    # Store the column order so inference can reconstruct the same feature frame
    model_artifact = {
        "model": clf,
        "feature_columns": X_cols,
        "categorical_features": categorical_features,
    }

    output_path = os.path.join(script_dir, "snv_disease_ranker_advanced.joblib")
    joblib.dump(model_artifact, output_path)
    print(f"Advanced model saved to {output_path}")


if __name__ == "__main__":
    main()
