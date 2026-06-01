import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?reason=no_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/auth/error?reason=exchange_failed`);
  }

  const email = data.user.email!.toLowerCase();

  // Invite gate: owner always passes; others need an invite row.
  // Uses the admin client because invites have no client RLS policies (deny-all).
  if (email !== process.env.OWNER_EMAIL?.toLowerCase()) {
    const admin = createAdminClient();
    const { data: invite } = await admin
      .from("invites")
      .select("id, used_at")
      .eq("email", email)
      .maybeSingle();

    if (!invite) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/auth/error?reason=not_invited`);
    }

    if (!invite.used_at) {
      await admin
        .from("invites")
        .update({ used_at: new Date().toISOString() })
        .eq("id", invite.id);
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
