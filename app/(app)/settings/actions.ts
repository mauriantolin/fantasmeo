"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { classificationTitle, suggestedStatus } from "@/lib/gmail/sync";

const ACTIVE_STATUSES = ["applied", "response_received", "interview", "offer"];

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

function isOwner(email: string | undefined): boolean {
  return (
    !!email &&
    !!process.env.OWNER_EMAIL &&
    email.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase()
  );
}

// ── Profile ──────────────────────────────────────────────────────────────────

const updateProfileInput = z.object({
  fullName: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedinUrl: z
    .string()
    .optional()
    .refine((v) => !v || v === "" || z.string().url().safeParse(v).success, {
      message: "URL inválida",
    }),
});

export async function updateProfile(input: z.infer<typeof updateProfileInput>) {
  const parsed = updateProfileInput.parse(input);
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.fullName ?? null,
      phone: parsed.phone ?? null,
      location: parsed.location ?? null,
      linkedin_url: parsed.linkedinUrl || null,
    })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

// ── Gmail ─────────────────────────────────────────────────────────────────────

export async function disconnectGmail() {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("gmail_connections")
    .delete()
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

// ── Invites (owner-only, admin client) ───────────────────────────────────────

const addInviteInput = z.object({
  email: z.string().email(),
});

export async function addInvite(input: z.infer<typeof addInviteInput>) {
  const parsed = addInviteInput.parse(input);
  const { user } = await requireUser();

  if (!isOwner(user.email)) throw new Error("Forbidden");

  const admin = createAdminClient();
  const { error } = await admin.from("invites").insert({
    email: parsed.email.toLowerCase(),
    invited_by: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function listInvites() {
  const { user } = await requireUser();

  if (!isOwner(user.email)) throw new Error("Forbidden");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invites")
    .select("id, email, used_at, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Email review ──────────────────────────────────────────────────────────────

const confirmEmailMatchInput = z.object({
  emailId: z.string().uuid(),
  confirm: z.boolean(),
});

export async function confirmEmailMatch(
  input: z.infer<typeof confirmEmailMatchInput>
) {
  const parsed = confirmEmailMatchInput.parse(input);
  const { supabase, user } = await requireUser();

  // Fetch the matched email (RLS ensures it belongs to this user)
  const { data: matched, error: fetchError } = await supabase
    .from("matched_emails")
    .select("id, application_id, ai_classification, match_confidence, from_address, subject")
    .eq("id", parsed.emailId)
    .single();

  if (fetchError || !matched) throw new Error("Email no encontrado");

  if (!parsed.confirm) {
    // Reject: clear application link
    const { error } = await supabase
      .from("matched_emails")
      .update({ match_status: "rejected", application_id: null })
      .eq("id", parsed.emailId);
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
    return;
  }

  // Confirm: update match_status and create timeline event
  const { error: updateError } = await supabase
    .from("matched_emails")
    .update({ match_status: "confirmed" })
    .eq("id", parsed.emailId);

  if (updateError) throw new Error(updateError.message);

  const classification = matched.ai_classification as {
    classification: string;
    summary: string;
  } | null;

  const appId = matched.application_id as string | null;
  if (!appId) throw new Error("No hay postulación asociada");

  // Add timeline event
  const { error: eventError } = await supabase
    .from("application_events")
    .insert({
      application_id: appId,
      user_id: user.id,
      type: "email_received",
      title: classificationTitle(classification?.classification ?? "other"),
      description: classification?.summary ?? null,
      email_id: parsed.emailId,
      metadata: {
        from: matched.from_address,
        subject: matched.subject,
        classification: classification?.classification ?? "other",
      },
    });

  if (eventError) throw new Error(eventError.message);

  // Apply suggested status change (never downgrade terminal states)
  const newStatus = suggestedStatus(classification?.classification ?? "other");
  if (newStatus) {
    await supabase
      .from("applications")
      .update({ status: newStatus })
      .eq("id", appId)
      .in("status", ACTIVE_STATUSES);
  }

  revalidatePath("/settings");
  revalidatePath(`/applications/${appId}`);
}
