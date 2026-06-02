-- Trigger functions should never be callable through the REST RPC surface.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Pin search_path so the trigger function cannot be hijacked via a malicious schema.
alter function public.set_updated_at() set search_path = '';
