create extension if not exists pgcrypto;

alter table public.prediction_history
  add column if not exists reference text,
  add column if not exists alternative text,
  add column if not exists variant_type text,
  add column if not exists hgvs_g text,
  add column if not exists rsid text,
  add column if not exists clinvar_variation_id text,
  add column if not exists gene_symbol text,
  add column if not exists transcript_id text,
  add column if not exists source text not null default 'manual',
  add column if not exists disease_class text,
  add column if not exists disease_confidence double precision,
  add column if not exists disease_source text,
  add column if not exists disease_lookup_status text;

create table if not exists public.variants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  assembly text not null,
  chromosome text not null,
  position bigint not null,
  ref text not null,
  alt text not null,
  variant_type text not null,
  hgvs_g text,
  rsid text,
  clinvar_variation_id text,
  gene_symbol text,
  transcript_id text,
  source text not null default 'manual',
  original_input jsonb not null default '{}'::jsonb,
  normalized_input jsonb not null default '{}'::jsonb,
  unique (user_id, assembly, chromosome, position, ref, alt)
);

create table if not exists public.variant_annotations (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id) on delete cascade,
  created_at timestamptz not null default now(),
  provider text not null,
  consequence text,
  transcript_id text,
  hgvs_c text,
  hgvs_p text,
  rsid text,
  scores jsonb not null default '{}'::jsonb,
  raw_response_hash text,
  provider_version text
);

create table if not exists public.disease_associations (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id) on delete cascade,
  created_at timestamptz not null default now(),
  disease_name text not null,
  ontology_ids text[] not null default '{}',
  source text not null,
  clinical_significance text,
  evidence_level text,
  review_status text,
  accession text,
  variation_id text,
  pmids text[] not null default '{}',
  source_url text,
  confidence double precision,
  raw_evidence jsonb not null default '{}'::jsonb
);

create table if not exists public.lookup_audit (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid references public.variants(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  trace_id text not null,
  provider text not null,
  status text not null,
  latency_ms double precision,
  request_url text,
  request_payload jsonb not null default '{}'::jsonb,
  raw_response_hash text,
  failure_reason text,
  fallback_path text[] not null default '{}'
);

create index if not exists variants_identity_idx
  on public.variants (assembly, chromosome, position, ref, alt);

create index if not exists variants_clinvar_idx
  on public.variants (clinvar_variation_id)
  where clinvar_variation_id is not null;

create index if not exists disease_associations_variant_idx
  on public.disease_associations (variant_id);

create index if not exists lookup_audit_trace_idx
  on public.lookup_audit (trace_id);

alter table public.variants enable row level security;
alter table public.variant_annotations enable row level security;
alter table public.disease_associations enable row level security;
alter table public.lookup_audit enable row level security;

drop policy if exists "Users can read own variants" on public.variants;
create policy "Users can read own variants"
  on public.variants for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own variants" on public.variants;
create policy "Users can insert own variants"
  on public.variants for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own lookup audit" on public.lookup_audit;
create policy "Users can read own lookup audit"
  on public.lookup_audit for select
  using (auth.uid() = user_id);
