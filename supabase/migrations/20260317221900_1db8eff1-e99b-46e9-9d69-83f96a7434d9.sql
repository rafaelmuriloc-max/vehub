
create table public.service_takers (
  id uuid primary key default gen_random_uuid(),
  document text not null,
  company_name text not null,
  municipal_registration text,
  email text,
  phone text,
  street text,
  number text,
  neighborhood text,
  municipality_code text,
  uf text,
  zip_code text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(document)
);

alter table public.service_takers enable row level security;

create policy "Authenticated users can view takers"
  on public.service_takers for select to authenticated using (true);

create policy "Authenticated users can insert takers"
  on public.service_takers for insert to authenticated with check (true);

create policy "Authenticated users can update takers"
  on public.service_takers for update to authenticated using (true);
