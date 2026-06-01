alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.base_cvs enable row level security;
alter table public.applications enable row level security;
alter table public.generated_cvs enable row level security;
alter table public.cover_letters enable row level security;
alter table public.application_events enable row level security;
alter table public.gmail_connections enable row level security;
alter table public.matched_emails enable row level security;

-- profiles: own row only
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- invites: any authenticated user can read (needed for the invite gate),
-- create invites, and mark them as used (the gate updates used_at)
create policy "invites_select" on public.invites
  for select using (auth.role() = 'authenticated');
create policy "invites_insert" on public.invites
  for insert with check (auth.role() = 'authenticated');
create policy "invites_update" on public.invites
  for update using (auth.role() = 'authenticated');

-- user-owned tables: identical pattern
create policy "base_cvs_own" on public.base_cvs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "applications_own" on public.applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "generated_cvs_own" on public.generated_cvs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cover_letters_own" on public.cover_letters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "application_events_own" on public.application_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gmail_connections_own" on public.gmail_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "matched_emails_own" on public.matched_emails
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
