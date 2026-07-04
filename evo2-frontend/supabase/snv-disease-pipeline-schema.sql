create extension if not exists pgcrypto;

alter table public.prediction_history
  add column if not exists variant_key text,
  add column if not exists reference text,
  add column if not exists alternative text,
  add column if not exists clinvar_evidence jsonb not null default '[]'::jsonb,
  add column if not exists disease_model_ranking jsonb not null default '[]'::jsonb,
  add column if not exists final_interpretation jsonb;

create table if not exists public.evo2_cache (
  variant_key text not null,
  assembly text not null default 'hg38',
  gene text,
  chrom text not null,
  pos bigint not null,
  ref text not null,
  alt text not null,
  evo2_prediction text not null,
  evo2_score double precision,
  delta_score double precision,
  raw_prediction text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (assembly, variant_key)
);

create table if not exists public.clinvar_disease_lookup (
  id uuid primary key default gen_random_uuid(),
  variant_key text not null,
  assembly text not null default 'hg38',
  gene text,
  chrom text not null,
  pos bigint not null,
  ref text not null,
  alt text not null,
  disease_name text not null,
  disease_id text,
  clinical_significance text,
  sig_group text,
  review_status text,
  review_score integer,
  variation_id text,
  rsid text,
  source text not null default 'ClinVar',
  created_at timestamptz not null default now()
);

create table if not exists public.disease_predictions (
  id uuid primary key default gen_random_uuid(),
  variant_key text not null,
  assembly text not null default 'hg38',
  gene text,
  disease_name text not null,
  association_score double precision not null,
  source text not null default 'custom_ml_model',
  model_version text,
  created_at timestamptz not null default now()
);

create index if not exists clinvar_disease_lookup_variant_idx
  on public.clinvar_disease_lookup (assembly, variant_key);

create index if not exists clinvar_disease_lookup_gene_idx
  on public.clinvar_disease_lookup (assembly, gene)
  where gene is not null;

create index if not exists disease_predictions_variant_idx
  on public.disease_predictions (assembly, variant_key);

alter table public.evo2_cache enable row level security;
alter table public.clinvar_disease_lookup enable row level security;
alter table public.disease_predictions enable row level security;

drop policy if exists "Authenticated users can read Evo2 cache" on public.evo2_cache;
create policy "Authenticated users can read Evo2 cache"
  on public.evo2_cache for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can write Evo2 cache" on public.evo2_cache;
create policy "Authenticated users can write Evo2 cache"
  on public.evo2_cache for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update Evo2 cache" on public.evo2_cache;
create policy "Authenticated users can update Evo2 cache"
  on public.evo2_cache for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can read ClinVar disease lookup" on public.clinvar_disease_lookup;
create policy "Authenticated users can read ClinVar disease lookup"
  on public.clinvar_disease_lookup for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read disease predictions" on public.disease_predictions;
create policy "Authenticated users can read disease predictions"
  on public.disease_predictions for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert disease predictions" on public.disease_predictions;
create policy "Authenticated users can insert disease predictions"
  on public.disease_predictions for insert
  to authenticated
  with check (true);
