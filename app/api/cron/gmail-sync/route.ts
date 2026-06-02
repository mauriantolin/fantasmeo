import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncConnection } from "@/lib/gmail/sync";

export const runtime = "nodejs";
export const maxDuration = 300; // Fluid Compute allows up to 300s on Hobby

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  // The explicit !secret guard prevents "Bearer undefined" from passing when the env var is missing
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data: connections } = await admin
    .from("gmail_connections")
    .select("id, user_id, email_address, access_token_enc, refresh_token_enc, last_sync_at")
    .eq("status", "active");

  const results = [];
  for (const connection of connections ?? []) {
    try {
      results.push(await syncConnection(admin, connection));
    } catch (error) {
      // Per-connection isolation: one failing connection never blocks the others
      await admin
        .from("gmail_connections")
        .update({ status: "error" })
        .eq("id", connection.id);
      results.push({
        connectionId: connection.id,
        scanned: 0,
        matched: 0,
        pendingReview: 0,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}
