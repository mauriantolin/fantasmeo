"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchJD, ScrapeError } from "@/lib/scraping/jd-fetcher";
import { parseJD } from "@/lib/ai/parse-jd";
import type { JDSummary, ApplicationStatus, EventType } from "@/lib/types";

const createFromUrlInput = z.object({ url: z.string().url() });
const createManualInput = z.object({
  jdText: z.string().min(100),
  url: z.string().url().optional().or(z.literal("")),
});

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

async function addEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  applicationId: string,
  type: EventType,
  title: string,
  description?: string,
  metadata?: Record<string, unknown>
) {
  await supabase.from("application_events").insert({
    application_id: applicationId,
    user_id: userId,
    type,
    title,
    description,
    metadata,
  });
}

// Returns { jdText, jdSummary } or { error: "scrape_failed" } so the UI can fall back to paste mode
export async function previewFromUrl(input: z.infer<typeof createFromUrlInput>) {
  const { url } = createFromUrlInput.parse(input);
  await requireUser();
  try {
    const jdText = await fetchJD(url);
    const jdSummary = await parseJD(jdText, url);
    return { jdText, jdSummary };
  } catch (e) {
    if (e instanceof ScrapeError) return { error: "scrape_failed" as const };
    throw e;
  }
}

export async function previewFromText(input: z.infer<typeof createManualInput>) {
  const { jdText, url } = createManualInput.parse(input);
  await requireUser();
  const jdSummary = await parseJD(jdText, url || undefined);
  return { jdText, jdSummary };
}

const createApplicationInput = z.object({
  companyName: z.string().min(1),
  positionTitle: z.string().min(1),
  platform: z.string().min(1),
  jobUrl: z.string().url().optional().or(z.literal("")),
  jdText: z.string(),
  jdSummary: z.unknown(), // already-validated JDSummary passed through from preview
  markAsApplied: z.boolean(),
});

export async function createApplication(input: z.infer<typeof createApplicationInput>) {
  const parsed = createApplicationInput.parse(input);
  const { supabase, user } = await requireUser();

  const status: ApplicationStatus = parsed.markAsApplied ? "applied" : "draft";
  const { data: application, error } = await supabase
    .from("applications")
    .insert({
      user_id: user.id,
      company_name: parsed.companyName,
      position_title: parsed.positionTitle,
      platform: parsed.platform,
      job_url: parsed.jobUrl || null,
      jd_text: parsed.jdText,
      jd_summary: parsed.jdSummary as JDSummary,
      status,
      applied_at: parsed.markAsApplied ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await addEvent(supabase, user.id, application.id, "created", "Postulación creada");
  if (parsed.markAsApplied) {
    await addEvent(supabase, user.id, application.id, "applied", "Te postulaste");
  }

  revalidatePath("/applications");
  redirect(`/applications/${application.id}`);
}

const updateStatusInput = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(["draft","applied","response_received","interview","offer","rejected","ghosted","withdrawn"]),
});

export async function updateStatus(input: z.infer<typeof updateStatusInput>) {
  const parsed = updateStatusInput.parse(input);
  const { supabase, user } = await requireUser();

  const updates: Record<string, unknown> = { status: parsed.status };
  if (parsed.status === "applied") updates.applied_at = new Date().toISOString();

  const { error } = await supabase
    .from("applications")
    .update(updates)
    .eq("id", parsed.applicationId);
  if (error) throw new Error(error.message);

  await addEvent(
    supabase, user.id, parsed.applicationId, "status_changed",
    "Cambio de estado", undefined, { new_status: parsed.status }
  );

  revalidatePath(`/applications/${parsed.applicationId}`);
  revalidatePath("/applications");
}

const updateApplicationInput = z.object({
  applicationId: z.string().uuid(),
  companyName: z.string().min(1),
  positionTitle: z.string().min(1),
  platform: z.string().min(1),
  jobUrl: z.string().url().optional().or(z.literal("")),
});

export async function updateApplication(
  input: z.infer<typeof updateApplicationInput>
) {
  const parsed = updateApplicationInput.parse(input);
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("applications")
    .update({
      company_name: parsed.companyName,
      position_title: parsed.positionTitle,
      platform: parsed.platform,
      job_url: parsed.jobUrl || null,
    })
    .eq("id", parsed.applicationId);
  if (error) throw new Error(error.message);

  revalidatePath(`/applications/${parsed.applicationId}`);
  revalidatePath("/applications");
}

const addNoteInput = z.object({ applicationId: z.string().uuid(), note: z.string().min(1) });

export async function addNote(input: z.infer<typeof addNoteInput>) {
  const parsed = addNoteInput.parse(input);
  const { supabase, user } = await requireUser();
  await addEvent(supabase, user.id, parsed.applicationId, "note_added", "Nota", parsed.note);
  revalidatePath(`/applications/${parsed.applicationId}`);
}

const deleteInput = z.object({ applicationId: z.string().uuid() });

export async function deleteApplication(input: z.infer<typeof deleteInput>) {
  const parsed = deleteInput.parse(input);
  const { supabase } = await requireUser();
  const { error } = await supabase.from("applications").delete().eq("id", parsed.applicationId);
  if (error) throw new Error(error.message);
  revalidatePath("/applications");
  redirect("/applications");
}
