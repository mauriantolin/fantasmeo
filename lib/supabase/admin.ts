import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Bypasses RLS — use only in server-side code that performs its own authorization checks:
// cron endpoint, auth-callback invite gate, and owner-only invite management in settings.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
