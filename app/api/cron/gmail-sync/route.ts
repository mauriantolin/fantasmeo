import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncConnection } from "@/lib/gmail/sync";

export const runtime = "nodejs";
export const maxDuration = 300; // Fluid Compute allows up to 300s on Hobby

// Any application with status='applied' that has received an email will have
// its status changed away from 'applied' by the sync logic in sync.ts
// (suggestedStatus). So status='applied' + old applied_at is sufficient to
// identify ghosted applications — no need to check for absence of email events.
const GHOSTED_AFTER_DAYS = 21;

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

  const cutoff = new Date(Date.now() - GHOSTED_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: staleApps } = await admin
    .from("applications")
    .select("id, user_id")
    .eq("status", "applied")
    .lt("applied_at", cutoff);

  for (const app of staleApps ?? []) {
    await admin.from("applications").update({ status: "ghosted" }).eq("id", app.id);
    await admin.from("application_events").insert({
      application_id: app.id,
      user_id: app.user_id,
      type: "status_changed",
      title: "Marcada como ghosteada 👻",
      description: `${GHOSTED_AFTER_DAYS} días sin respuesta`,
      metadata: { new_status: "ghosted", auto: true },
    });
  }

  return NextResponse.json({ synced: results.length, results, ghosted: staleApps?.length ?? 0 });
}
