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
  for all using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- invites: no client-side policies. With RLS enabled and no policies, all direct
-- client access is denied. Invites are managed exclusively server-side through the
-- service-role client (invite gate in the auth callback, invite management in settings),
-- which bypasses RLS. This prevents authenticated users from forging or recycling invites.

-- user-owned tables: identical pattern
create policy "base_cvs_own" on public.base_cvs
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "applications_own" on public.applications
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "generated_cvs_own" on public.generated_cvs
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "cover_letters_own" on public.cover_letters
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "application_events_own" on public.application_events
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "gmail_connections_own" on public.gmail_connections
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "matched_emails_own" on public.matched_emails
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
