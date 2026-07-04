import os
import sys

import requests


POSITIVE_CONTROLS = [
    {
        "name": "HBB rs334 candidate ranking",
        "payload": {
            "model_version": "snv_disease_ranker_no_evo2",
            "candidates": [
                {
                    "chrom": "11",
                    "pos": 5227002,
                    "ref": "T",
                    "alt": "A",
                    "gene": "HBB",
                    "disease_name": "Sickle cell disease",
                    "review_score": 3,
                    "is_transition": 0,
                    "position_mod_1000": 2,
                }
            ],
        },
        "expected_disease": "Sickle cell disease",
    }
]


def main() -> int:
    endpoint_url = os.environ.get("DISEASE_MODEL_ENDPOINT_URL")
    api_key = os.environ.get("MODAL_API_KEY") or os.environ.get("API_KEY")

    if not endpoint_url or not api_key:
        print(
            "Set DISEASE_MODEL_ENDPOINT_URL and MODAL_API_KEY before running "
            "positive controls.",
            file=sys.stderr,
        )
        return 2

    for control in POSITIVE_CONTROLS:
        response = requests.post(
            endpoint_url,
            json=control["payload"],
            headers={
                "Content-Type": "application/json",
                "X-API-Key": api_key,
            },
            timeout=60,
        )
        print(f"{control['name']}: HTTP {response.status_code}")
        response.raise_for_status()

        result = response.json()
        if result.get("error"):
            print("Positive control could not run:", result)
            return 2

        ranking = result.get("ranking") or []
        top_disease = ranking[0].get("disease_name") if ranking else None

        if top_disease != control["expected_disease"]:
            print("Positive control failed.")
            print(result)
            return 1

        print("PASS:", top_disease, ranking[0].get("association_score"))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
