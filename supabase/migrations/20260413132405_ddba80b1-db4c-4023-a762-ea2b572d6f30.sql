
create table public.sitfis_results (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  status text not null default 'pending',
  consulted_at timestamp with time zone not null default now(),
  pdf_base64 text,
  raw_response jsonb,
  error_message text,
  unique(client_id)
);

alter table public.sitfis_results enable row level security;

create policy "Authenticated can view sitfis_results"
  on public.sitfis_results
  for select to authenticated using (true);

create policy "Admins can manage sitfis_results"
  on public.sitfis_results
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));
