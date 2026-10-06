-- Une mesure du serveur par minute (processeur, mémoire, disque), gardée 48 h : alimente la page /admin/server.
create table if not exists public.server_resource_samples (
  id bigint generated always as identity primary key,
  collected_at timestamptz not null default now(),
  source text not null,
  scope text not null,
  hostname text not null,
  cpu_percent real,
  cpu_steal_percent real,
  cpu_load_1 real,
  memory_percent real,
  memory_used_bytes bigint,
  memory_total_bytes bigint,
  disk_percent real
);

create index if not exists server_resource_samples_collected_at_idx on public.server_resource_samples (collected_at desc);
alter table public.server_resource_samples enable row level security;
revoke all on public.server_resource_samples from anon, authenticated;
grant all on public.server_resource_samples to service_role;
