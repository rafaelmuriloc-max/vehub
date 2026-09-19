create table public.drive_sync_configs (
  id uuid primary key default gen_random_uuid(),
  folder_id text not null,
  folder_name text not null,
  department_id uuid references public.departments(id),
  obligation_id uuid references public.obligations(id),
  allowed_doc_type_ids uuid[] not null default '{}',
  enabled boolean not null default true,
  last_synced_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.drive_sync_configs to authenticated;
grant insert, update, delete on public.drive_sync_configs to authenticated;
grant all on public.drive_sync_configs to service_role;
alter table public.drive_sync_configs enable row level security;

create policy drive_sync_configs_admin_all on public.drive_sync_configs
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create trigger update_drive_sync_configs_updated_at before update on public.drive_sync_configs
  for each row execute function public.update_updated_at_column();

create table public.drive_synced_files (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.drive_sync_configs(id) on delete cascade,
  drive_file_id text not null,
  drive_name text,
  drive_path text,
  drive_modified_time timestamptz,
  status text not null default 'pending_review',
  document_id uuid references public.documents(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (config_id, drive_file_id)
);

grant select on public.drive_synced_files to authenticated;
grant all on public.drive_synced_files to service_role;
alter table public.drive_synced_files enable row level security;

create policy drive_synced_files_select on public.drive_synced_files
  for select to authenticated using (true);

create trigger update_drive_synced_files_updated_at before update on public.drive_synced_files
  for each row execute function public.update_updated_at_column();