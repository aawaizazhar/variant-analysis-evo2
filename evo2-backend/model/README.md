# Disease ranker artifacts

The corrected SNV disease-association endpoint expects:

- `snv_disease_ranker_no_evo2.joblib`
- `clinvar_curated_snv_disease_lookup.csv` for Supabase import
- optionally `snv_disease_training_pairs_no_evo2.csv` for audit/retraining

The older Keras/dbNSFP files in this directory are not used by the corrected
runtime path. Do not use Evo2 outputs as disease-ranker training features.
