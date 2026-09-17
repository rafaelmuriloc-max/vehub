alter table public.profiles add column if not exists must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is 'True quando o usuário ainda usa senha temporária criada pelo admin e deve trocá-la no primeiro acesso';