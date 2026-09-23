import os
import sys

import modal
from fastapi import Header, HTTPException
from pydantic import BaseModel

class VariantRequest(BaseModel):
    variant_position: int
    alternative: str
    genome: str
    chromosome: str


class DiseaseCandidate(BaseModel):
    chrom: str
    pos: int
    ref: str
    alt: str
    gene: str
    disease_name: str
    review_score: int | float = 0
    is_transition: int | bool = 0
    position_mod_1000: int | None = None
    CADD_phred: float | None = None
    SIFT_score: float | None = None
    Polyphen2_HDIV_score: float | None = None
    REVEL_score: float | None = None
    gnomAD_AF: float | None = None
    LRT_score: float | None = None
    PROVEAN_score: float | None = None
    phyloP100way: float | None = None
    phastCons100way: float | None = None


class DiseaseAssociationRequest(BaseModel):
    candidates: list[DiseaseCandidate] = []
    model_version: str | None = None
    variant_key: str | None = None

    # Legacy fields are optional so old clients fail safely instead of creating
    # a fake disease prediction from incomplete candidate context.
    variant_position: int | None = None
    reference: str | None = None
    alternative: str | None = None
    genome: str | None = None
    chromosome: str | None = None
    gene: str | None = None
    rsid: str | None = None
    clinvar_variation_id: str | None = None
    hgvs_g: str | None = None
    transcript_id: str | None = None
    source: str | None = None


# Working image configuration for evo2 on Modal with H100
evo2_image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.6.0-devel-ubuntu22.04", add_python="3.12"
    )
    .apt_install([
        "build-essential",
        "cmake",
        "ninja-build",
        "git",
        "gcc",
        "libcudnn9-cuda-12",
        "libcudnn9-dev-cuda-12",
       # Use cuDNN 9 for CUDA 12.4
    ])
    .env({"CXX": "/usr/bin/g++",
     "CC": "/usr/bin/gcc",
    })

    .run_commands(
        # 1️⃣ Upgrade pip & build tools
        "pip install --upgrade pip setuptools wheel packaging ninja",

        # 2️⃣ Install PyTorch 2.6.0 for CUDA 12.4
        "pip install torch==2.6.0 torchvision==0.21.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu126",

        # 3️⃣ Install Transformer Engine 2.6.0.post1
      "pip install 'transformer-engine[pytorch]==2.6.0.post1'",


        # 4️⃣ Install flash-attn compatible with TE
        "pip install flash-attn==2.7.4.post1",

        # 5️⃣ Clone Evo2 and install in editable mode
        "git clone https://github.com/arcinstitute/evo2 /root/evo2 && "
        "pip install -e /root/evo2"
       
    )
    # 6️⃣ Install remaining dependencies
    .pip_install_from_requirements("requirements.txt")
)

disease_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "fastapi[standard]",
        "joblib",
        "numpy",
        "pandas",
        "pydantic",
        "scikit-learn==1.8.0",
        "requests",
    )
    .add_local_file(
        "model/snv_disease_ranker_no_evo2.joblib",
        remote_path="/root/model/snv_disease_ranker_no_evo2.joblib",
    )
    .add_local_file(
        "model/snv_disease_ranker_advanced.joblib",
        remote_path="/root/model/snv_disease_ranker_advanced.joblib",
    )
)

app = modal.App("variant-analysis-evo2", image=evo2_image)

volume = modal.Volume.from_name("hf_cache", create_if_missing=True)
mount_path = "/root/.cache/huggingface"


@app.function(gpu="H100", volumes={mount_path: volume}, timeout=1000)
def run_brca1_analysis():
    import base64
    from io import BytesIO
    from Bio import SeqIO
    import gzip
    import matplotlib.pyplot as plt
    import numpy as np
    import pandas as pd
    import os
    import seaborn as sns
    from sklearn.metrics import roc_auc_score, roc_curve

    from evo2 import Evo2

    WINDOW_SIZE = 8192

    print("Loading evo2 model...")
    model = Evo2('evo2_7b')
    print("Evo2 model loaded")

    brca1_df = pd.read_excel(
        '/evo2/notebooks/brca1/41586_2018_461_MOESM3_ESM.xlsx',
        header=2,
    )
    brca1_df = brca1_df[[
        'chromosome', 'position (hg19)', 'reference', 'alt', 'function.score.mean', 'func.class',
    ]]

    brca1_df.rename(columns={
        'chromosome': 'chrom',
        'position (hg19)': 'pos',
        'reference': 'ref',
        'alt': 'alt',
        'function.score.mean': 'score',
        'func.class': 'class',
    }, inplace=True)

    # Convert to two-class system
    brca1_df['class'] = brca1_df['class'].replace(['FUNC', 'INT'], 'FUNC/INT')

    with gzip.open('/evo2/notebooks/brca1/GRCh37.p13_chr17.fna.gz', "rt") as handle:
        for record in SeqIO.parse(handle, "fasta"):
            seq_chr17 = str(record.seq)
            break

    # Build mappings of unique reference sequences
    ref_seqs = []
    ref_seq_to_index = {}

    # Parse sequences and store indexes
    ref_seq_indexes = []
    var_seqs = []

    brca1_subset = brca1_df.iloc[:500].copy()

    for _, row in brca1_subset.iterrows():
        p = row["pos"] - 1  # Convert to 0-indexed position
        full_seq = seq_chr17

        ref_seq_start = max(0, p - WINDOW_SIZE//2)
        ref_seq_end = min(len(full_seq), p + WINDOW_SIZE//2)
        ref_seq = seq_chr17[ref_seq_start:ref_seq_end]
        snv_pos_in_ref = min(WINDOW_SIZE//2, p)
        var_seq = ref_seq[:snv_pos_in_ref] + \
            row["alt"] + ref_seq[snv_pos_in_ref+1:]

        # Get or create index for reference sequence
        if ref_seq not in ref_seq_to_index:
            ref_seq_to_index[ref_seq] = len(ref_seqs)
            ref_seqs.append(ref_seq)

        ref_seq_indexes.append(ref_seq_to_index[ref_seq])
        var_seqs.append(var_seq)

    ref_seq_indexes = np.array(ref_seq_indexes)

    print(
        f'Scoring likelihoods of {len(ref_seqs)} reference sequences with Evo 2...')
    ref_scores = model.score_sequences(ref_seqs)

    print(
        f'Scoring likelihoods of {len(var_seqs)} variant sequences with Evo 2...')
    var_scores = model.score_sequences(var_seqs)

    # Subtract score of corresponding reference sequences from scores of variant sequences
    delta_scores = np.array(var_scores) - np.array(ref_scores)[ref_seq_indexes]

    # Add delta scores to dataframe
    brca1_subset[f'evo2_delta_score'] = delta_scores

    y_true = (brca1_subset['class'] == 'LOF')
    auroc = roc_auc_score(y_true, -brca1_subset['evo2_delta_score'])

    # --- Calculate threshold START
    y_true = (brca1_subset["class"] == "LOF")

    fpr, tpr, thresholds = roc_curve(y_true, -brca1_subset["evo2_delta_score"])

    optimal_idx = (tpr - fpr).argmax()

    optimal_threshold = -thresholds[optimal_idx]

    lof_scores = brca1_subset.loc[brca1_subset["class"]
                                  == "LOF", "evo2_delta_score"]
    func_scores = brca1_subset.loc[brca1_subset["class"]
                                   == "FUNC/INT", "evo2_delta_score"]

    lof_std = lof_scores.std()
    func_std = func_scores.std()

    confidence_params = {
        "threshold": optimal_threshold,
        "lof_std": lof_std,
        "func_std": func_std
    }

    print("Confidence params:", confidence_params)

    # --- Calculate threshold END

    plt.figure(figsize=(4, 2))

    # Plot stripplot of distributions
    p = sns.stripplot(
        data=brca1_subset,
        x='evo2_delta_score',
        y='class',
        hue='class',
        order=['FUNC/INT', 'LOF'],
        palette=['#777777', 'C3'],
        size=2,
        jitter=0.3,
    )

    # Mark medians from each distribution
    sns.boxplot(showmeans=True,
                meanline=True,
                meanprops={'visible': False},
                medianprops={'color': 'k', 'ls': '-', 'lw': 2},
                whiskerprops={'visible': False},
                zorder=10,
                x="evo2_delta_score",
                y="class",
                data=brca1_subset,
                showfliers=False,
                showbox=False,
                showcaps=False,
                ax=p)
    plt.xlabel('Delta likelihood score, Evo 2')
    plt.ylabel('BRCA1 SNV class')
    plt.tight_layout()

    buffer = BytesIO()
    plt.savefig(buffer, format="png")
    buffer.seek(0)
    plot_data = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return {'variants': brca1_subset.to_dict(orient="records"), "plot": plot_data, "auroc": auroc}


@app.function()
def brca1_example():
    import base64
    from io import BytesIO
    import matplotlib.pyplot as plt
    import matplotlib.image as mpimg

    print("Running BRCA1 variant analysis with Evo2...")

    # Run inference
    result = run_brca1_analysis.remote()

    if "plot" in result:
        plot_data = base64.b64decode(result["plot"])
        with open("brca1_analysis_plot.png", "wb") as f:
            f.write(plot_data)

        img = mpimg.imread(BytesIO(plot_data))
        plt.figure(figsize=(10, 5))
        plt.imshow(img)
        plt.axis("off")
        plt.show()


def get_genome_sequence(position, genome: str, chromosome: str, window_size=8192):
    import requests

    half_window = window_size // 2
    start = max(0, position - 1 - half_window)
    end = position - 1 + half_window + 1

    print(
        f"Fetching {window_size}bp window around position {position} from UCSC API..")
    print(f"Coordinates: {chromosome}:{start}-{end} ({genome})")

    api_url = f"https://api.genome.ucsc.edu/getData/sequence?genome={genome};chrom={chromosome};start={start};end={end}"
    response = requests.get(api_url)

    if response.status_code != 200:
        raise Exception(
            f"Failed to fetch genome sequence from UCSC API: {response.status_code}")

    genome_data = response.json()

    if "dna" not in genome_data:
        error = genome_data.get("error", "Unknown error")
        raise Exception(f"UCSC API errpr: {error}")

    sequence = genome_data.get("dna", "").upper()
    expected_length = end - start
    if len(sequence) != expected_length:
        print(
            f"Warning: received sequence length ({len(sequence)}) differs from expected ({expected_length})")

    print(
        f"Loaded reference genome sequence window (length: {len(sequence)} bases)")

    return sequence, start


def analyze_variant(relative_pos_in_window, reference, alternative, window_seq, model):
    var_seq = window_seq[:relative_pos_in_window] + \
        alternative + window_seq[relative_pos_in_window+1:]

    ref_score = model.score_sequences([window_seq])[0]
    var_score = model.score_sequences([var_seq])[0]

    delta_score = var_score - ref_score

    threshold = -0.0009178519
    lof_std = 0.0015140239
    func_std = 0.0009016589

    if delta_score < threshold:
        prediction = "Likely pathogenic"
        confidence = min(1.0, abs(delta_score - threshold) / lof_std)
    else:
        prediction = "Likely benign"
        confidence = min(1.0, abs(delta_score - threshold) / func_std)

    return {
        "reference": reference,
        "alternative": alternative,
        "delta_score": float(delta_score),
        "prediction": prediction,
        "classification_confidence": float(confidence)
    }


@app.cls(gpu="H100", volumes={mount_path: volume}, max_containers=3, retries=2, scaledown_window=120,
        secrets=[modal.Secret.from_name("api-auth-key")])
class Evo2Model:
    @modal.enter()
    def load_evo2_model(self):
        from evo2 import Evo2
        print("Loading evo2 model...")
        self.model = Evo2('evo2_7b')
        print("Evo2 model loaded")

    @modal.fastapi_endpoint(method="POST")
    def analyze_single_variant(self, request: VariantRequest,
                               x_api_key: str = Header(alias="X-API-Key")):
        # Verify API key
        expected_key = os.environ.get("API_KEY", "")
        if not x_api_key or x_api_key != expected_key:
            raise HTTPException(status_code=401, detail="Unauthorized")

        variant_position = request.variant_position
        alternative = request.alternative
        genome = request.genome
        chromosome = request.chromosome

        print("Genome:", genome)
        print("Chromosome:", chromosome)
        print("Variant position:", variant_position)
        print("Variant alternative:", alternative)

        WINDOW_SIZE = 8192

        window_seq, seq_start = get_genome_sequence(
            position=variant_position,
            genome=genome,
            chromosome=chromosome,
            window_size=WINDOW_SIZE
        )

        print(f"Fetched genome seauence window, first 100: {window_seq[:100]}")

        relative_pos = variant_position - 1 - seq_start
        print(f"Relative position within window: {relative_pos}")

        if relative_pos < 0 or relative_pos >= len(window_seq):
            raise ValueError(
                f"Variant position {variant_position} is outside the fetched window (start={seq_start+1}, end={seq_start+len(window_seq)})")

        reference = window_seq[relative_pos]
        print("Reference is: " + reference)

        if alternative.upper() == reference.upper():
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Alternative base must be different from the reference "
                    f"base ({reference})."
                ),
            )

        # Analyze the variant
        result = analyze_variant(
            relative_pos_in_window=relative_pos,
            reference=reference,
            alternative=alternative,
            window_seq=window_seq,
            model=self.model
        )

        result["position"] = variant_position

        return result


@app.cls(image=disease_image, max_containers=3, retries=2, scaledown_window=120,
         secrets=[modal.Secret.from_name("api-auth-key")])
class DiseaseAssociationModel:
    MIN_OBSERVED_MODEL_FEATURES = 3

    @modal.enter()
    def load_disease_model(self):
        from pathlib import Path

        import joblib

        model_dir = Path("/root/model")

        advanced_path = model_dir / "snv_disease_ranker_advanced.joblib"
        legacy_path = model_dir / "snv_disease_ranker_no_evo2.joblib"
        
        self.model = None
        self.model_error = None

        # Biological feature columns used by annotation helpers
        self.feature_columns = [
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
        self.feature_defaults = {
            "CADD_phred": 0.0,
            "SIFT_score": 1.0,
            "Polyphen2_HDIV_score": 0.0,
            "REVEL_score": 0.0,
            "gnomAD_AF": 0.0,
            "LRT_score": 0.0,
            "PROVEAN_score": 0.0,
            "phyloP100way": 0.0,
            "phastCons100way": 0.0,
        }

        print("Loading SNV disease association ranker...")
        try:
            if advanced_path.exists():
                self.model = joblib.load(advanced_path)
                self.model_version = "snv_disease_ranker_advanced"
            else:
                self.model = joblib.load(legacy_path)
                self.model_version = "snv_disease_ranker_no_evo2"
        except FileNotFoundError:
            self.model_version = "unknown"
            self.model_error = (
                "Missing model artifact: /root/model/"
                "snv_disease_ranker_advanced.joblib"
            )
            print(self.model_error)
        except Exception as exc:
            self.model_error = f"Failed to load disease ranker: {exc}"
            print(self.model_error)
        else:
            print("SNV disease association ranker loaded")

    def _collect_numbers(self, value):
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return [float(value)]

        if isinstance(value, str):
            try:
                return [float(value)]
            except ValueError:
                return []

        if isinstance(value, list):
            numbers = []
            for item in value:
                numbers.extend(self._collect_numbers(item))
            return numbers

        return []

    def _values_at_path(self, payload, path):
        current_values = [payload]

        for part in path.split("."):
            next_values = []
            for value in current_values:
                if isinstance(value, list):
                    for item in value:
                        if isinstance(item, dict) and part in item:
                            next_values.append(item[part])
                elif isinstance(value, dict) and part in value:
                    next_values.append(value[part])
            current_values = next_values

        numbers = []
        for value in current_values:
            numbers.extend(self._collect_numbers(value))

        return numbers

    def _raw_values_at_path(self, payload, path):
        current_values = [payload]

        for part in path.split("."):
            next_values = []
            for value in current_values:
                if isinstance(value, list):
                    for item in value:
                        if isinstance(item, dict) and part in item:
                            next_values.append(item[part])
                elif isinstance(value, dict) and part in value:
                    next_values.append(value[part])
            current_values = next_values

        flattened_values = []
        for value in current_values:
            if isinstance(value, list):
                flattened_values.extend(value)
            else:
                flattened_values.append(value)

        return flattened_values

    def _first_number(self, payload, paths, strategy="first"):
        numbers = []
        for path in paths:
            numbers.extend(self._values_at_path(payload, path))

        if not numbers:
            return None

        if strategy == "max":
            return max(numbers)

        if strategy == "min":
            return min(numbers)

        return numbers[0]

    def _find_number_by_path_terms(self, payload, required_terms, strategy="max"):
        matches = []

        def walk(value, path):
            if isinstance(value, dict):
                for key, child in value.items():
                    walk(child, f"{path}.{key}" if path else key)
                return

            if isinstance(value, list):
                for index, child in enumerate(value):
                    walk(child, f"{path}.{index}" if path else str(index))
                return

            lowered_path = path.lower()
            if all(term in lowered_path for term in required_terms):
                matches.extend(self._collect_numbers(value))

        walk(payload, "")

        if not matches:
            return None

        if strategy == "min":
            return min(matches)

        if strategy == "first":
            return matches[0]

        return max(matches)

    def _matches_ref_alt(self, payload, reference, alternative):
        candidate_pairs = [
            (
                self._raw_values_at_path(payload, "dbnsfp.ref"),
                self._raw_values_at_path(payload, "dbnsfp.alt"),
            ),
            (
                self._raw_values_at_path(payload, "cadd.ref"),
                self._raw_values_at_path(payload, "cadd.alt"),
            ),
        ]

        for refs, alts in candidate_pairs:
            for ref in refs:
                for alt in alts:
                    if str(ref).upper() == reference and str(alt).upper() == alternative:
                        return True

        variant_id = str(payload.get("_id", "")).upper()
        return f"{reference}>{alternative}" in variant_id

    def _extract_feature_values(self, annotation):
        gnomad_af = self._first_number(
            annotation,
            [
                "dbnsfp.gnomad_exomes.af",
                "dbnsfp.gnomad_genomes.af",
                "dbnsfp.gnomad_exome.af",
                "dbnsfp.gnomad_genome.af",
            ],
            strategy="max",
        )
        if gnomad_af is None:
            gnomad_af = self._find_number_by_path_terms(
                annotation,
                ["gnomad", "af"],
                strategy="max",
            )

        return {
            "CADD_phred": self._first_number(
                annotation,
                ["dbnsfp.cadd.phred", "cadd.phred"],
                strategy="max",
            ),
            "SIFT_score": self._first_number(
                annotation,
                ["dbnsfp.sift.score"],
                strategy="min",
            ),
            "Polyphen2_HDIV_score": self._first_number(
                annotation,
                ["dbnsfp.polyphen2.hdiv.score"],
                strategy="max",
            ),
            "REVEL_score": self._first_number(
                annotation,
                ["dbnsfp.revel.score"],
                strategy="max",
            ),
            "gnomAD_AF": gnomad_af,
            "LRT_score": self._first_number(
                annotation,
                ["dbnsfp.lr.score"],
                strategy="first",
            ),
            "PROVEAN_score": self._first_number(
                annotation,
                ["dbnsfp.provean.score"],
                strategy="min",
            ),
            "phyloP100way": self._first_number(
                annotation,
                ["dbnsfp.phylop.100way.vertebrate"],
                strategy="max",
            ),
            "phastCons100way": self._first_number(
                annotation,
                ["dbnsfp.phastcons.100way.vertebrate"],
                strategy="max",
            ),
        }

    def _aggregate_gene_features(self, hits):
        import statistics

        values_by_feature = {
            feature: []
            for feature in self.feature_columns
        }

        for hit in hits:
            feature_values = self._extract_feature_values(hit)
            for feature, value in feature_values.items():
                if value is not None:
                    values_by_feature[feature].append(float(value))

        features = {}
        for feature, values in values_by_feature.items():
            if not values:
                features[feature] = None
            elif feature in {"SIFT_score", "PROVEAN_score"}:
                features[feature] = min(values)
            elif feature in {"CADD_phred", "Polyphen2_HDIV_score", "REVEL_score"}:
                features[feature] = max(values)
            else:
                features[feature] = statistics.median(values)

        return features

    def _debug_enabled(self):
        return os.environ.get("VARIANT_LOOKUP_DEBUG", "").lower() in {
            "1",
            "true",
            "yes",
            "on",
        }

    def _safe_json_preview(self, value, limit=2500):
        import json

        try:
            text = json.dumps(value, default=str, sort_keys=True)
        except TypeError:
            text = str(value)

        if len(text) > limit:
            return f"{text[:limit]}...<truncated>"

        return text

    def _hash_payload(self, value):
        import hashlib

        return hashlib.sha256(
            self._safe_json_preview(value, limit=100000).encode("utf-8")
        ).hexdigest()

    def _lookup_log(self, trace_id, event, **payload):
        if not self._debug_enabled():
            return

        safe_payload = {
            key: value
            for key, value in payload.items()
            if "key" not in key.lower() and "token" not in key.lower()
        }
        print(
            "[variant-lookup]",
            self._safe_json_preview(
                {"trace_id": trace_id, "event": event, **safe_payload},
                limit=4000,
            ),
        )

    def _public_lookup_trace(self, trace_id, event, **payload):
        safe_payload = {
            key: value
            for key, value in payload.items()
            if "key" not in key.lower() and "token" not in key.lower()
        }
        print(
            "[variant-lookup]",
            self._safe_json_preview(
                {"trace_id": trace_id, "event": event, **safe_payload},
                limit=4000,
            ),
        )

    def _normalize_assembly(self, genome):
        normalized = (genome or "").strip().lower()
        if normalized in {"hg19", "grch37", "grch37.p13"}:
            return "hg19"
        if normalized in {"hg38", "grch38", "grch38.p14", "grch38.p13"}:
            return "hg38"
        return normalized

    def _normalize_chromosome(self, chromosome):
        value = str(chromosome or "").strip()
        if not value:
            return ""
        if not value.lower().startswith("chr"):
            value = f"chr{value}"
        prefix = "chr"
        chrom = value[3:]
        return f"{prefix}{chrom.upper() if chrom.upper() in {'X', 'Y', 'M', 'MT'} else chrom}"

    def _review_status_confidence(self, review_status):
        status = str(review_status or "").lower()
        if "practice guideline" in status or "expert panel" in status:
            return 0.95
        if "multiple submitters" in status and "conflict" not in status:
            return 0.85
        if "single submitter" in status:
            return 0.65
        if "criteria provided" in status:
            return 0.6
        if "no assertion" in status:
            return 0.35
        return 0.5

    def _preprocess_variant(self, request, trace_id):
        assembly = self._normalize_assembly(request.genome)
        chromosome = self._normalize_chromosome(request.chromosome)
        reference = str(request.reference or "").strip().upper()
        alternative = str(request.alternative or "").strip().upper()
        variant_type = "SNV" if len(reference) == 1 and len(alternative) == 1 else "unsupported"

        malformed = []
        if assembly not in {"hg19", "hg38"}:
            malformed.append("assembly_mismatch")
        if not chromosome:
            malformed.append("missing_chromosome")
        elif not chromosome[3:] or not chromosome.lower().startswith("chr"):
            malformed.append("invalid_chromosome")
        if request.variant_position <= 0:
            malformed.append("missing_position")
        if not reference:
            malformed.append("missing_ref")
        if not alternative:
            malformed.append("missing_alt")
        if reference == alternative and reference:
            malformed.append("reference_equals_alternate")
        if reference and not all(base in "ACGT" for base in reference):
            malformed.append("invalid_ref")
        if alternative and not all(base in "ACGT" for base in alternative):
            malformed.append("invalid_alt")
        if variant_type != "SNV":
            malformed.append("unsupported_variant_type")

        hgvs_g = (
            request.hgvs_g.strip()
            if request.hgvs_g and request.hgvs_g.strip()
            else f"{chromosome}:g.{request.variant_position}{reference}>{alternative}"
        )

        canonical = {
            "assembly": assembly,
            "chromosome": chromosome,
            "position": int(request.variant_position),
            "ref": reference,
            "alt": alternative,
            "variant_type": variant_type,
            "hgvs_g": hgvs_g,
            "rsid": (request.rsid or "").strip() or None,
            "clinvar_variation_id": (request.clinvar_variation_id or "").strip() or None,
            "gene_symbol": (request.gene or "").strip() or None,
            "transcript_id": (request.transcript_id or "").strip() or None,
            "source": (request.source or "").strip() or "manual",
            "malformed_fields": sorted(set(malformed)),
            "provided_hgvs_g": bool(request.hgvs_g and request.hgvs_g.strip()),
        }
        canonical["variant_key"] = (
            f"{assembly}:{chromosome}:{request.variant_position}:{reference}>{alternative}"
        )

        self._lookup_log(trace_id, "canonical_variant", normalized_variant=canonical)
        self._public_lookup_trace(
            trace_id,
            "disease_lookup_input",
            gene=canonical["gene_symbol"],
            assembly=canonical["assembly"],
            chromosome=canonical["chromosome"],
            position=canonical["position"],
            ref=canonical["ref"],
            alt=canonical["alt"],
            hgvs_g=canonical["hgvs_g"],
            rsid=canonical["rsid"],
            clinvar_variation_id=canonical["clinvar_variation_id"],
            source=canonical["source"],
        )

        blocking = {
            "assembly_mismatch",
            "missing_chromosome",
            "invalid_chromosome",
            "missing_position",
            "missing_ref",
            "missing_alt",
            "reference_equals_alternate",
            "invalid_ref",
            "invalid_alt",
            "unsupported_variant_type",
        }
        blocking_errors = [field for field in canonical["malformed_fields"] if field in blocking]
        if blocking_errors:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "malformed",
                    "message": "Variant input is not a supported germline SNV.",
                    "malformed_fields": blocking_errors,
                    "canonical_variant": canonical,
                },
            )

        return canonical

    def _request_json(self, trace_id, provider, method, url, **kwargs):
        import time
        import requests

        start_time = time.perf_counter()
        response = requests.request(method, url, **kwargs)
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        try:
            payload = response.json()
        except ValueError:
            payload = {"raw_text": response.text}

        self._lookup_log(
            trace_id,
            "api_response",
            provider=provider,
            method=method,
            url=response.url,
            status_code=response.status_code,
            latency_ms=elapsed_ms,
            raw_response_hash=self._hash_payload(payload),
            raw_response_preview=self._safe_json_preview(payload),
        )

        return response, payload, elapsed_ms

    def _clinvar_search_plan(self, canonical):
        chrom = canonical["chromosome"].replace("chr", "")
        if canonical["clinvar_variation_id"]:
            return {
                "term": f"{canonical['clinvar_variation_id']}[uid]",
                "match_mode": "trusted_id",
                "query_source": "clinvar_variation_id",
            }
        if canonical["rsid"]:
            return {
                "term": canonical["rsid"],
                "match_mode": "trusted_id",
                "query_source": "rsid",
            }
        if canonical.get("provided_hgvs_g") and canonical["hgvs_g"]:
            return {
                "term": canonical["hgvs_g"],
                "match_mode": "coordinate",
                "query_source": "provided_hgvs_g",
            }

        chrpos_field = "chrpos37" if canonical["assembly"] == "hg19" else "chrpos38"
        terms = [
            f"{chrom}[chromosome]",
            f"{canonical['position']}:{canonical['position']}[{chrpos_field}]",
        ]
        if canonical["gene_symbol"]:
            terms.append(f"{canonical['gene_symbol']}[gene]")

        return {
            "term": " AND ".join(terms),
            "match_mode": "coordinate",
            "query_source": chrpos_field,
        }

    def _complement_base(self, base):
        complements = {"A": "T", "T": "A", "C": "G", "G": "C"}
        return complements.get(str(base).upper())

    def _accepted_clinvar_match_reason(self, record, canonical, match_mode):
        if match_mode == "trusted_id":
            return "trusted_identifier"

        if self._matches_ref_alt(record, canonical["ref"], canonical["alt"]):
            return "exact_ref_alt_payload"

        title = str(record.get("title", "")).upper()
        exact_ref_alt = f"{canonical['ref']}>{canonical['alt']}"
        if exact_ref_alt in title:
            return "exact_ref_alt_title"

        ref_complement = self._complement_base(canonical["ref"])
        alt_complement = self._complement_base(canonical["alt"])
        if ref_complement and alt_complement:
            complement_ref_alt = f"{ref_complement}>{alt_complement}"
            if complement_ref_alt in title:
                return "reverse_complement_title"

        return None

    def _as_list(self, value):
        if value is None:
            return []
        if isinstance(value, list):
            return value
        return [value]

    def _find_text_by_key_terms(self, payload, required_terms):
        matches = []

        def walk(value, path):
            if isinstance(value, dict):
                for key, child in value.items():
                    walk(child, f"{path}.{key}" if path else key)
                return
            if isinstance(value, list):
                for index, child in enumerate(value):
                    walk(child, f"{path}.{index}" if path else str(index))
                return

            lowered_path = path.lower()
            if all(term in lowered_path for term in required_terms) and value not in {None, ""}:
                matches.append(str(value))

        walk(payload, "")
        return matches

    def _extract_clinvar_associations(self, record, canonical, match_reason):
        classification = (
            record.get("germline_classification", {}).get("description")
            if isinstance(record.get("germline_classification"), dict)
            else None
        ) or record.get("clinical_significance") or "Unknown"
        review_status = (
            record.get("germline_classification", {}).get("review_status")
            if isinstance(record.get("germline_classification"), dict)
            else None
        ) or record.get("review_status") or "Unknown"

        trait_names = []
        for trait in self._as_list(record.get("trait_set")):
            if isinstance(trait, dict):
                name = (
                    trait.get("trait_name")
                    or trait.get("name")
                    or trait.get("preferred_name")
                    or trait.get("label")
                )
                if name:
                    trait_names.append(str(name))

        if not trait_names:
            trait_names.extend(self._find_text_by_key_terms(record, ["trait", "name"]))
        if not trait_names:
            trait_names.extend(self._find_text_by_key_terms(record, ["disease", "name"]))
        if not trait_names:
            trait_names = ["Condition not specified"]

        variation_id = str(record.get("uid") or record.get("variation_id") or "")
        accession = str(record.get("accession") or record.get("accession_version") or "")
        confidence = self._review_status_confidence(review_status)

        associations = []
        for disease_name in sorted(set(trait_names)):
            associations.append(
                {
                    "source": "ClinVar",
                    "disease_name": disease_name,
                    "ontology_ids": [],
                    "clinical_significance": str(classification),
                    "evidence_level": str(review_status),
                    "review_status": str(review_status),
                    "accession": accession or None,
                    "variation_id": variation_id or canonical["clinvar_variation_id"],
                    "url": (
                        f"https://www.ncbi.nlm.nih.gov/clinvar/variation/{variation_id}"
                        if variation_id
                        else None
                    ),
                    "confidence": confidence,
                    "match_reason": match_reason,
                }
            )

        return associations

    def _lookup_clinvar(self, canonical, trace_id):
        search_plan = self._clinvar_search_plan(canonical)
        self._lookup_log(
            trace_id,
            "clinvar_search_plan",
            term=search_plan["term"],
            match_mode=search_plan["match_mode"],
            query_source=search_plan["query_source"],
        )

        search_response, search_payload, search_latency = self._request_json(
            trace_id,
            "ClinVar",
            "GET",
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
            params={
                "db": "clinvar",
                "term": search_plan["term"],
                "retmode": "json",
                "retmax": 10,
            },
            timeout=30,
        )

        if search_response.status_code == 429:
            return {
                "status": "rate_limited",
                "failure_reason": "rate_limited",
                "associations": [],
                "latency_ms": search_latency,
            }
        if search_response.status_code != 200:
            return {
                "status": "api_error",
                "failure_reason": f"api_error:{search_response.status_code}",
                "associations": [],
                "latency_ms": search_latency,
            }

        ids = search_payload.get("esearchresult", {}).get("idlist", [])
        if not ids:
            return {
                "status": "not_found",
                "failure_reason": "not_found",
                "associations": [],
                "latency_ms": search_latency,
            }

        summary_response, summary_payload, summary_latency = self._request_json(
            trace_id,
            "ClinVar",
            "GET",
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi",
            params={
                "db": "clinvar",
                "id": ",".join(ids),
                "retmode": "json",
            },
            timeout=30,
        )

        if summary_response.status_code == 429:
            return {
                "status": "rate_limited",
                "failure_reason": "rate_limited",
                "associations": [],
                "latency_ms": summary_latency,
            }
        if summary_response.status_code != 200:
            return {
                "status": "api_error",
                "failure_reason": f"api_error:{summary_response.status_code}",
                "associations": [],
                "latency_ms": summary_latency,
            }

        result = summary_payload.get("result", {})
        associations = []
        unmatched_ids = []
        for uid in result.get("uids", []):
            record = result.get(uid, {})
            if not isinstance(record, dict):
                continue

            match_reason = self._accepted_clinvar_match_reason(
                record,
                canonical,
                search_plan["match_mode"],
            )
            if not match_reason:
                unmatched_ids.append(uid)
                self._lookup_log(
                    trace_id,
                    "clinvar_rejected_record",
                    uid=uid,
                    title=record.get("title"),
                    expected_ref_alt=f"{canonical['ref']}>{canonical['alt']}",
                )
                continue

            associations.extend(
                self._extract_clinvar_associations(
                    {**record, "uid": uid},
                    canonical,
                    match_reason,
                )
            )

        self._lookup_log(
            trace_id,
            "clinvar_match_summary",
            requested_ids=ids,
            matched_associations=len(associations),
            unmatched_ids=unmatched_ids,
        )

        if not associations:
            return {
                "status": "not_found",
                "failure_reason": "no_ref_alt_match",
                "associations": [],
                "latency_ms": summary_latency,
            }

        return {
            "status": "success",
            "failure_reason": None,
            "associations": associations,
            "latency_ms": summary_latency,
        }

    def _myvariant_fields(self):
        fields = [
            "_id",
            "chrom",
            "vcf",
            "dbsnp.rsid",
            "clinvar",
            "cadd.phred",
            "cadd.ref",
            "cadd.alt",
            "dbnsfp.ref",
            "dbnsfp.alt",
            "dbnsfp.genename",
            "dbnsfp.cadd.phred",
            "dbnsfp.sift.score",
            "dbnsfp.polyphen2.hdiv.score",
            "dbnsfp.revel.score",
            "dbnsfp.gnomad_exomes.af",
            "dbnsfp.gnomad_genomes.af",
            "dbnsfp.gnomad_exome.af",
            "dbnsfp.gnomad_genome.af",
            "dbnsfp.lr.score",
            "dbnsfp.provean.score",
            "dbnsfp.phylop.100way.vertebrate",
            "dbnsfp.phastcons.100way.vertebrate",
        ]
        return ",".join(fields)

    def _annotate_gene_fallback(self, gene, fields, trace_id):
        import requests

        if not gene:
            return None

        gene_symbol = gene.strip()
        if not gene_symbol:
            return None

        response = requests.get(
            "https://myvariant.info/v1/query",
            params={
                "q": f"dbnsfp.genename:{gene_symbol}",
                "fields": fields,
                "size": 100,
            },
            timeout=30,
        )

        self._lookup_log(
            trace_id,
            "api_response",
            provider="MyVariant.info",
            method="GET",
            url=response.url,
            status_code=response.status_code,
            raw_response_preview=response.text[:2500],
        )

        if response.status_code != 200:
            return None

        hits = response.json().get("hits", [])
        if not hits:
            return None

        return self._aggregate_gene_features(hits)

    def _annotate_variant(self, canonical, trace_id):
        from urllib.parse import quote

        if canonical["assembly"] != "hg19":
            return {
                "status": "not_supported_for_assembly",
                "failure_reason": "liftover_required",
                "variant_id": canonical["hgvs_g"],
                "features": None,
                "available_features": [],
                "missing_features": [],
                "imputed_features": {},
                "annotation_source": None,
            }

        fields = self._myvariant_fields()
        encoded_variant_id = quote(canonical["hgvs_g"], safe="")
        response, payload, _ = self._request_json(
            trace_id,
            "MyVariant.info",
            "GET",
            f"https://myvariant.info/v1/variant/{encoded_variant_id}",
            params={"fields": fields},
            timeout=30,
        )

        annotation = None
        failure_reason = None
        annotation_source = "MyVariant.info/dbNSFP"

        if response.status_code == 200:
            annotation = payload
        elif response.status_code == 404:
            region_response, region_payload, _ = self._request_json(
                trace_id,
                "MyVariant.info",
                "GET",
                "https://myvariant.info/v1/query",
                params={
                    "q": (
                        f"{canonical['chromosome']}:"
                        f"{canonical['position']}-{canonical['position']}"
                    ),
                    "fields": fields,
                    "size": 25,
                },
                timeout=30,
            )

            if region_response.status_code == 200:
                hits = region_payload.get("hits", [])
                annotation = next(
                    (
                        hit
                        for hit in hits
                        if self._matches_ref_alt(hit, canonical["ref"], canonical["alt"])
                    ),
                    None,
                )
                if annotation is None:
                    failure_reason = "no_ref_alt_match"
                    gene_features = self._annotate_gene_fallback(
                        canonical["gene_symbol"],
                        fields,
                        trace_id,
                    )
                    if gene_features is not None:
                        annotation_source = "MyVariant.info/dbNSFP gene-level fallback"
                        return self._finalize_annotation_features(
                            canonical["hgvs_g"],
                            gene_features,
                            annotation_source,
                        )
            elif region_response.status_code == 429:
                failure_reason = "rate_limited"
            else:
                failure_reason = f"api_error:{region_response.status_code}"
        elif response.status_code == 429:
            failure_reason = "rate_limited"
        else:
            failure_reason = f"api_error:{response.status_code}"

        if annotation is None:
            return {
                "status": "not_found" if failure_reason in {None, "no_ref_alt_match"} else failure_reason,
                "failure_reason": failure_reason or "not_found",
                "variant_id": canonical["hgvs_g"],
                "features": None,
                "available_features": [],
                "missing_features": self.feature_columns,
                "imputed_features": {},
                "annotation_source": None,
            }

        features = self._extract_feature_values(annotation)
        return self._finalize_annotation_features(
            canonical["hgvs_g"],
            features,
            annotation_source,
        )

    def _finalize_annotation_features(self, variant_id, features, annotation_source):
        missing_features = [
            feature
            for feature in self.feature_columns
            if features.get(feature) is None
        ]

        available_features = [
            feature
            for feature in self.feature_columns
            if features.get(feature) is not None
        ]

        if not available_features:
            return {
                "status": "no_dbnsfp_features",
                "failure_reason": "no_dbnsfp_features",
                "variant_id": variant_id,
                "features": None,
                "available_features": [],
                "missing_features": missing_features,
                "imputed_features": {},
                "annotation_source": annotation_source,
            }

        for feature in missing_features:
            features[feature] = self.feature_defaults[feature]

        return {
            "status": "success",
            "failure_reason": None,
            "variant_id": variant_id,
            "features": features,
            "available_features": available_features,
            "missing_features": missing_features,
            "imputed_features": {
                feature: float(features[feature])
                for feature in missing_features
            },
            "annotation_source": annotation_source,
        }

    @modal.fastapi_endpoint(method="POST")
    def predict_disease_association(self, request: DiseaseAssociationRequest,
                                    x_api_key: str = Header(alias="X-API-Key")):
        expected_key = os.environ.get("API_KEY", "")
        if not x_api_key or x_api_key != expected_key:
            raise HTTPException(status_code=401, detail="Unauthorized")

        import pandas as pd

        if self.model is None:
            return {
                "ranking": [],
                "model_version": self.model_version,
                "error": "model_unavailable",
                "detail": self.model_error
                or "Disease ranker model is not loaded.",
            }

        try:
            if not request.candidates:
                return {
                    "ranking": [],
                    "model_version": self.model_version,
                    "error": "no_candidates",
                    "detail": "No candidate diseases were provided for ranking.",
                }

            # Fetch shared biological features for all candidates once
            first_candidate = request.candidates[0]
            canonical = {
                "assembly": "hg19",
                "chromosome": f"chr{first_candidate.chrom}",
                "position": first_candidate.pos,
                "ref": first_candidate.ref,
                "alt": first_candidate.alt,
                "hgvs_g": f"chr{first_candidate.chrom}:g.{first_candidate.pos}{first_candidate.ref}>{first_candidate.alt}",
                "gene_symbol": first_candidate.gene,
            }
            trace_id = "disease-prediction-trace"
            annotation_result = self._annotate_variant(canonical, trace_id)
            shared_features = annotation_result.get("features") or {}
        except Exception as top_level_exc:
            import traceback
            return {
                "ranking": [],
                "model_version": self.model_version,
                "error": "top_level_exception",
                "detail": traceback.format_exc(),
            }

        try:
            rows = []
            for candidate in request.candidates:
                disease_name = str(candidate.disease_name or "").strip()
                if not disease_name:
                    continue

                rows.append(
                    {
                        "chrom": str(candidate.chrom).replace("chr", "").replace("CHR", ""),
                        "pos": int(candidate.pos),
                        "ref": str(candidate.ref).strip().upper(),
                        "alt": str(candidate.alt).strip().upper(),
                        "gene": str(candidate.gene).strip().upper(),
                        "disease_name": disease_name,
                        "review_score": int(candidate.review_score),
                        "is_transition": int(candidate.is_transition),
                        "position_mod_1000": (
                            candidate.position_mod_1000
                            if candidate.position_mod_1000 is not None
                            else int(candidate.pos) % 1000
                        ),
                        "CADD_phred": float(candidate.CADD_phred) if candidate.CADD_phred is not None else float(shared_features.get("CADD_phred", float('nan')) if shared_features.get("CADD_phred") is not None else float('nan')),
                        "SIFT_score": float(candidate.SIFT_score) if candidate.SIFT_score is not None else float(shared_features.get("SIFT_score", float('nan')) if shared_features.get("SIFT_score") is not None else float('nan')),
                        "Polyphen2_HDIV_score": float(candidate.Polyphen2_HDIV_score) if candidate.Polyphen2_HDIV_score is not None else float(shared_features.get("Polyphen2_HDIV_score", float('nan')) if shared_features.get("Polyphen2_HDIV_score") is not None else float('nan')),
                        "REVEL_score": float(candidate.REVEL_score) if candidate.REVEL_score is not None else float(shared_features.get("REVEL_score", float('nan')) if shared_features.get("REVEL_score") is not None else float('nan')),
                        "gnomAD_AF": float(candidate.gnomAD_AF) if candidate.gnomAD_AF is not None else float(shared_features.get("gnomAD_AF", float('nan')) if shared_features.get("gnomAD_AF") is not None else float('nan')),
                        "LRT_score": float(candidate.LRT_score) if candidate.LRT_score is not None else float(shared_features.get("LRT_score", float('nan')) if shared_features.get("LRT_score") is not None else float('nan')),
                        "PROVEAN_score": float(candidate.PROVEAN_score) if candidate.PROVEAN_score is not None else float(shared_features.get("PROVEAN_score", float('nan')) if shared_features.get("PROVEAN_score") is not None else float('nan')),
                        "phyloP100way": float(candidate.phyloP100way) if candidate.phyloP100way is not None else float(shared_features.get("phyloP100way", float('nan')) if shared_features.get("phyloP100way") is not None else float('nan')),
                        "phastCons100way": float(candidate.phastCons100way) if candidate.phastCons100way is not None else float(shared_features.get("phastCons100way", float('nan')) if shared_features.get("phastCons100way") is not None else float('nan')),
                    }
                )

            if not rows:
                return {
                    "ranking": [],
                    "model_version": self.model_version,
                    "error": "no_valid_candidates",
                    "detail": "None of the candidates had a valid disease name.",
                }

            features = pd.DataFrame(rows)

            if isinstance(self.model, dict):
                clf = self.model["model"]
                expected_cols = self.model["feature_columns"]
                cat_features = self.model.get("categorical_features", [])
                
                # Add hashed columns for high-cardinality categoricals
                features["gene_hash"] = features["gene"].apply(lambda x: hash(str(x)) % 200)
                features["disease_name_hash"] = features["disease_name"].apply(lambda x: hash(str(x)) % 200)

                for col in cat_features:
                    if col in features.columns:
                        features[col] = features[col].astype(str).astype("category")

                # Reorder features exactly as training
                X = features[expected_cols]
            else:
                clf = self.model
                X = features.drop(columns=["chrom", "pos", "ref", "alt", "gene", "disease_name"])
                # Fallback for old model
                for col in ["chrom", "pos", "ref", "alt", "gene", "disease_name", "CADD_phred", "SIFT_score", "Polyphen2_HDIV_score", "REVEL_score", "gnomAD_AF", "LRT_score", "PROVEAN_score", "phyloP100way", "phastCons100way", "gene_hash", "disease_name_hash"]:
                    if col in X.columns:
                        X = X.drop(columns=[col])
        except Exception as data_prep_exc:
            import traceback
            return {
                "ranking": [],
                "model_version": self.model_version,
                "error": "data_prep_exception",
                "detail": traceback.format_exc(),
            }

        try:
            if hasattr(clf, "predict_proba"):
                probabilities = clf.predict_proba(X)
                class_order = list(getattr(clf, "classes_", [0, 1]))
                positive_index = (
                    class_order.index(1)
                    if 1 in class_order
                    else len(class_order) - 1
                )
                scores = probabilities[:, positive_index]
            else:
                scores = clf.predict(X)
        except Exception as exc:
            return {
                "ranking": [],
                "model_version": self.model_version,
                "error": "prediction_failed",
                "detail": str(exc),
            }

        ranking = []
        for row, score in zip(rows, scores):
            try:
                association_score = float(score)
            except (TypeError, ValueError):
                continue

            if association_score >= 1:
                association_score = 0.99
            elif association_score < 0:
                association_score = 0.0

            ranking.append(
                {
                    "disease_name": row["disease_name"],
                    "association_score": association_score,
                    "source": "custom_ml_model",
                }
            )

        ranking.sort(key=lambda item: item["association_score"], reverse=True)

        return {
            "ranking": ranking[:10],
            "model_version": self.model_version,
        }


@app.local_entrypoint()
def main():
    # Example of how you'd call the deployed Modal Function from your client
    import requests
    import json    # brca1_example.remote()

    evo2Model = Evo2Model()

    url = evo2Model.analyze_single_variant.web_url

    payload = {
        "variant_position": 43119628,
        "alternative": "G",
        "genome": "hg38",
        "chromosome": "chr17"
    }

    # Read the API key from the local environment for testing
    api_key = os.environ.get("API_KEY", "")

    headers = {
        "Content-Type": "application/json",
        "X-API-Key": api_key
    }

    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()
    result = response.json()
    print(result)
