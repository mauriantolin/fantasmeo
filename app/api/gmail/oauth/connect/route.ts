export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOAuthClient, GMAIL_SCOPES } from "@/lib/gmail/oauth";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const oauth = createOAuthClient();
  const url = oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh_token issuance every time
    scope: GMAIL_SCOPES,
    state: user.id,
  });

  return NextResponse.redirect(url);
}
