create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  created_by_user_id text not null,
  label text not null,
  prefix text not null,
  token_hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists api_keys_org_idx on public.api_keys(org_id);
create index if not exists api_keys_token_hash_idx on public.api_keys(token_hash);

grant all on public.api_keys to service_role;
alter table public.api_keys enable row level security;