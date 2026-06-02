export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { createOAuthClient } from "@/lib/gmail/oauth";
import { encrypt } from "@/lib/gmail/crypto";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // state must match the logged-in user (CSRF protection)
  if (!user || !code || state !== user.id) {
    return NextResponse.redirect(`${origin}/settings?gmail=error`);
  }

  // Token exchange and profile fetch hit Google's API — any failure (expired code,
  // network error) must land on the settings error state, never a raw 500.
  try {
    const oauth = createOAuthClient();
    const { tokens } = await oauth.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(`${origin}/settings?gmail=error`);
    }

    // Get the Gmail address this token belongs to
    oauth.setCredentials(tokens);
    const gmail = google.gmail({ version: "v1", auth: oauth });
    const profile = await gmail.users.getProfile({ userId: "me" });

    await supabase.from("gmail_connections").upsert(
      {
        user_id: user.id,
        email_address: profile.data.emailAddress!,
        access_token_enc: encrypt(tokens.access_token),
        refresh_token_enc: encrypt(tokens.refresh_token),
        token_expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        status: "active",
      },
      { onConflict: "user_id" }
    );

    return NextResponse.redirect(`${origin}/settings?gmail=connected`);
  } catch {
    return NextResponse.redirect(`${origin}/settings?gmail=error`);
  }
}
