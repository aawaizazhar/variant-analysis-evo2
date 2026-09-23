-- Shared analysis cache.
-- Rows are retained until an operator explicitly archives/deletes them, while
-- application code only reuses rows created during the previous six months.

create table if not exists public.analysis_result_cache (
  id uuid primary key default gen_random_uuid(),
  assembly text not null,
  variant_key text not null,
  gene_key text not null default '',
  explore_disease_associations boolean not null default false,
  evo2_prediction text not null,
  model_version_key text not null,
  policy_version integer not null,
  evo2_result jsonb not null,
  disease_association jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists analysis_result_cache_lookup_idx
  on public.analysis_result_cache (
    assembly,
    variant_key,
    gene_key,
    explore_disease_associations,
    evo2_prediction,
    model_version_key,
    policy_version,
    created_at desc
  );

alter table public.analysis_result_cache enable row level security;
revoke all on public.analysis_result_cache from public, anon, authenticated;
grant all on public.analysis_result_cache to service_role;

comment on table public.analysis_result_cache is
  'Server-owned analysis snapshots. Application reuse window is six months; rows are not automatically deleted.';
