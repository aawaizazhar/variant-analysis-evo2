# Supabase CSV imports

Import-ready ClinVar disease lookup:

```txt
evo2-frontend/supabase/imports/clinvar_disease_lookup.csv
```

This file was generated from:

```txt
evo2-backend/model/clinvar_curated_snv_disease_lookup.csv
```

Changes applied for `public.clinvar_disease_lookup`:

- removed training-only `label`
- added `assembly = hg38`
- added `source = ClinVar`
- kept only table import columns

Example `psql` import:

```sql
\copy public.clinvar_disease_lookup (
  variant_key,
  assembly,
  gene,
  chrom,
  pos,
  ref,
  alt,
  disease_name,
  disease_id,
  clinical_significance,
  sig_group,
  review_status,
  review_score,
  variation_id,
  rsid,
  source
) from 'evo2-frontend/supabase/imports/clinvar_disease_lookup.csv'
with (format csv, header true);
```
