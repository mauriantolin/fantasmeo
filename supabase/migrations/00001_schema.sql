-- Tables ---------------------------------------------------------------
create type application_status as enum (
  'draft','applied','response_received','interview','offer','rejected','ghosted','withdrawn'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  location text,
  linkedin_url text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create table public.base_cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  language text not null default 'es',
  raw_file_path text,
  content jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  position_title text not null,
  platform text not null default 'other',
  job_url text,
  jd_text text,
  jd_summary jsonb,
  status application_status not null default 'draft',
  applied_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.generated_cvs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  base_cv_id uuid references public.base_cvs(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  ghost_level int not null check (ghost_level between 0 and 100),
  content jsonb not null,
  pdf_path text,
  created_at timestamptz not null default now()
);

create table public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  pdf_path text,
  created_at timestamptz not null default now()
);

create table public.matched_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  gmail_message_id text not null,
  gmail_thread_id text,
  from_address text not null,
  from_name text,
  subject text,
  snippet text,
  body_text text,
  received_at timestamptz,
  match_confidence real,
  match_status text not null default 'pending_review'
    check (match_status in ('auto_matched','confirmed','rejected','pending_review')),
  ai_classification jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'created','applied','cv_generated','cover_letter_generated',
    'email_received','status_changed','note_added'
  )),
  title text not null,
  description text,
  email_id uuid references public.matched_emails(id) on delete set null,
  metadata jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email_address text not null,
  access_token_enc text not null,
  refresh_token_enc text not null,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  status text not null default 'active' check (status in ('active','error','disconnected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes ---------------------------------------------------------------
create index applications_user_status_idx on public.applications (user_id, status);
create index application_events_application_idx on public.application_events (application_id, occurred_at desc);
create index matched_emails_user_status_idx on public.matched_emails (user_id, match_status);

-- updated_at trigger ----------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger base_cvs_updated_at before update on public.base_cvs
  for each row execute function public.set_updated_at();
create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();
create trigger gmail_connections_updated_at before update on public.gmail_connections
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup -----------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
