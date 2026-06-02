import { google, type gmail_v1 } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createOAuthClient } from "@/lib/gmail/oauth";
import { decrypt, encrypt } from "@/lib/gmail/crypto";
import { isLikelyRelevant } from "@/lib/gmail/prefilter";
import { matchEmail } from "@/lib/ai/match-email";

const ACTIVE_STATUSES = ["applied", "response_received", "interview", "offer"];
const HIGH_CONFIDENCE = 0.8;
const MIN_CONFIDENCE = 0.5;

interface GmailConnection {
  id: string;
  user_id: string;
  email_address: string;
  access_token_enc: string;
  refresh_token_enc: string;
  last_sync_at: string | null;
}

interface SyncResult {
  connectionId: string;
  scanned: number;
  matched: number;
  pendingReview: number;
  error?: string;
}

function getHeader(message: gmail_v1.Schema$Message, name: string): string {
  return (
    message.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ""
  );
}

function getBody(message: gmail_v1.Schema$Message): string {
  // Prefer text/plain part; fall back to snippet
  function findPlainText(part: gmail_v1.Schema$MessagePart | undefined): string | null {
    if (!part) return null;
    if (part.mimeType === "text/plain" && part.body?.data) {
      return Buffer.from(part.body.data, "base64url").toString("utf8");
    }
    for (const child of part.parts ?? []) {
      const found = findPlainText(child);
      if (found) return found;
    }
    return null;
  }
  return findPlainText(message.payload) ?? message.snippet ?? "";
}

export async function syncConnection(
  admin: SupabaseClient,
  connection: GmailConnection
): Promise<SyncResult> {
  const result: SyncResult = {
    connectionId: connection.id,
    scanned: 0,
    matched: 0,
    pendingReview: 0,
  };

  // 1. Set up authenticated Gmail client
  const oauth = createOAuthClient();
  oauth.setCredentials({
    access_token: decrypt(connection.access_token_enc),
    refresh_token: decrypt(connection.refresh_token_enc),
  });

  // Persist refreshed access tokens
  oauth.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await admin
        .from("gmail_connections")
        .update({
          access_token_enc: encrypt(tokens.access_token),
          token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        })
        .eq("id", connection.id);
    }
  });

  const gmail = google.gmail({ version: "v1", auth: oauth });

  // 2. Get the user's active applications
  const { data: applications } = await admin
    .from("applications")
    .select("id, company_name, position_title, platform, status, applied_at")
    .eq("user_id", connection.user_id)
    .in("status", ACTIVE_STATUSES);

  if (!applications || applications.length === 0) {
    return result; // nothing to match against
  }

  // 3. List messages since last sync (default: last 3 days on first sync)
  const sinceDate = connection.last_sync_at
    ? new Date(connection.last_sync_at)
    : new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const query = `in:inbox after:${Math.floor(sinceDate.getTime() / 1000)}`;

  const listResponse = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 50,
  });

  const messageRefs = listResponse.data.messages ?? [];
  result.scanned = messageRefs.length;

  // 4. Process each message
  for (const ref of messageRefs) {
    // Skip already-processed messages
    const { data: existing } = await admin
      .from("matched_emails")
      .select("id")
      .eq("user_id", connection.user_id)
      .eq("gmail_message_id", ref.id!)
      .maybeSingle();
    if (existing) continue;

    const messageResponse = await gmail.users.messages.get({
      userId: "me",
      id: ref.id!,
      format: "full",
    });

    const message = messageResponse.data;

    const from = getHeader(message, "From");
    const subject = getHeader(message, "Subject");
    const body = getBody(message);
    const receivedAt = new Date(Number(message.internalDate)).toISOString();

    // 5. Cheap prefilter before spending AI tokens
    if (!isLikelyRelevant({ from, subject, body }, applications)) continue;

    // 6. AI matching
    const match = await matchEmail({ from, subject, body, receivedAt }, applications);

    if (!match.application_id || match.confidence < MIN_CONFIDENCE) continue;

    const isAutoMatch = match.confidence >= HIGH_CONFIDENCE;

    // 7. Store the matched email
    const { data: storedEmail } = await admin
      .from("matched_emails")
      .insert({
        user_id: connection.user_id,
        application_id: match.application_id,
        gmail_message_id: ref.id!,
        gmail_thread_id: message.threadId,
        from_address: from,
        subject,
        snippet: message.snippet,
        body_text: body.slice(0, 10000),
        received_at: receivedAt,
        match_confidence: match.confidence,
        match_status: isAutoMatch ? "auto_matched" : "pending_review",
        ai_classification: match,
      })
      .select("id")
      .single();

    if (isAutoMatch && storedEmail) {
      result.matched++;
      // 8. Add timeline event
      await admin.from("application_events").insert({
        application_id: match.application_id,
        user_id: connection.user_id,
        type: "email_received",
        title: classificationTitle(match.classification),
        description: match.summary,
        email_id: storedEmail.id,
        metadata: { from, subject, classification: match.classification },
      });

      // 9. Suggest status change
      const newStatus = suggestedStatus(match.classification);
      if (newStatus) {
        await admin
          .from("applications")
          .update({ status: newStatus })
          .eq("id", match.application_id)
          .in("status", ACTIVE_STATUSES); // never downgrade terminal states
      }
    } else {
      result.pendingReview++;
    }
  }

  // 10. Update last sync timestamp
  await admin
    .from("gmail_connections")
    .update({ last_sync_at: new Date().toISOString(), status: "active" })
    .eq("id", connection.id);

  return result;
}

export function classificationTitle(classification: string): string {
  switch (classification) {
    case "rejection": return "Rechazo recibido";
    case "interview": return "Invitación a entrevista";
    case "offer": return "¡Oferta recibida!";
    case "info_request": return "Pedido de información";
    default: return "Respuesta recibida";
  }
}

export function suggestedStatus(classification: string): string | null {
  switch (classification) {
    case "rejection": return "rejected";
    case "interview": return "interview";
    case "offer": return "offer";
    case "info_request": return "response_received";
    default: return "response_received";
  }
}
