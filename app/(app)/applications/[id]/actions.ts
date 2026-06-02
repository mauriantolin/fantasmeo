"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { tailorCV } from "@/lib/ai/tailor-cv";
import { generateCoverLetter } from "@/lib/ai/cover-letter";
import { getGhostInstructions } from "@/lib/ai/ghost-level";
import { cvContentSchema } from "@/lib/schemas";
import type { CVContent, JDSummary, EventType } from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

async function addEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  applicationId: string,
  type: EventType,
  title: string,
  description?: string
) {
  await supabase.from("application_events").insert({
    application_id: applicationId,
    user_id: userId,
    type,
    title,
    description,
  });
}

// --- generateTailoredCV ---

const generateTailoredCVInput = z.object({
  applicationId: z.string().uuid(),
  baseCvId: z.string().uuid(),
  ghostLevel: z.number().int().min(0).max(100),
});

export async function generateTailoredCV(
  input: z.infer<typeof generateTailoredCVInput>
) {
  const { applicationId, baseCvId, ghostLevel } =
    generateTailoredCVInput.parse(input);
  const { supabase, user } = await requireUser();

  const [{ data: baseCV }, { data: application }] = await Promise.all([
    supabase
      .from("base_cvs")
      .select("content, language")
      .eq("id", baseCvId)
      .single(),
    supabase
      .from("applications")
      .select("jd_summary, jd_text")
      .eq("id", applicationId)
      .single(),
  ]);

  if (!baseCV?.content) throw new Error("El CV base no tiene contenido.");
  if (!application?.jd_summary)
    throw new Error("La postulación no tiene resumen de descripción del puesto.");

  const tailored = await tailorCV(
    baseCV.content as CVContent,
    application.jd_summary as JDSummary,
    application.jd_text ?? "",
    ghostLevel
  );

  const { data: generated, error } = await supabase
    .from("generated_cvs")
    .insert({
      application_id: applicationId,
      base_cv_id: baseCvId,
      user_id: user.id,
      ghost_level: ghostLevel,
      content: tailored,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await addEvent(
    supabase,
    user.id,
    applicationId,
    "cv_generated",
    "CV generado",
    `Nivel de fantasmeo: ${ghostLevel}`
  );

  revalidatePath(`/applications/${applicationId}`);
  return { id: generated.id };
}

// --- generateCoverLetterAction ---

const generateCoverLetterInput = z.object({
  applicationId: z.string().uuid(),
  generatedCvId: z.string().uuid().optional(),
  baseCvId: z.string().uuid().optional(),
});

export async function generateCoverLetterAction(
  input: z.infer<typeof generateCoverLetterInput>
) {
  const { applicationId, generatedCvId, baseCvId } =
    generateCoverLetterInput.parse(input);

  if (!generatedCvId && !baseCvId)
    throw new Error("Necesitás proveer generatedCvId o baseCvId.");

  const { supabase, user } = await requireUser();

  const { data: application } = await supabase
    .from("applications")
    .select("jd_summary, jd_text")
    .eq("id", applicationId)
    .single();

  if (!application?.jd_summary)
    throw new Error("La postulación no tiene resumen de descripción del puesto.");

  let cvContent: CVContent;
  let ghostLevel = 0;

  if (generatedCvId) {
    const { data: genCV } = await supabase
      .from("generated_cvs")
      .select("content, ghost_level")
      .eq("id", generatedCvId)
      .single();
    if (!genCV?.content) throw new Error("No se encontró el CV generado.");
    cvContent = genCV.content as CVContent;
    ghostLevel = genCV.ghost_level as number;
  } else {
    const { data: baseCV } = await supabase
      .from("base_cvs")
      .select("content")
      .eq("id", baseCvId!)
      .single();
    if (!baseCV?.content) throw new Error("El CV base no tiene contenido.");
    cvContent = baseCV.content as CVContent;
  }

  const ghostInstructions = getGhostInstructions(ghostLevel);

  const letter = await generateCoverLetter(
    cvContent,
    application.jd_summary as JDSummary,
    application.jd_text ?? "",
    ghostInstructions
  );

  const { data: coverLetter, error } = await supabase
    .from("cover_letters")
    .insert({
      application_id: applicationId,
      user_id: user.id,
      content: letter,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await addEvent(
    supabase,
    user.id,
    applicationId,
    "cover_letter_generated",
    "Cover letter generada"
  );

  revalidatePath(`/applications/${applicationId}`);
  return { id: coverLetter.id };
}

// --- updateGeneratedCV ---

const updateGeneratedCVInput = z.object({
  id: z.string().uuid(),
  content: cvContentSchema,
});

export async function updateGeneratedCV(
  input: z.infer<typeof updateGeneratedCVInput>
) {
  const { id, content } = updateGeneratedCVInput.parse(input);
  const { supabase } = await requireUser();

  const { data: existing, error: fetchError } = await supabase
    .from("generated_cvs")
    .select("application_id")
    .eq("id", id)
    .single();

  if (fetchError || !existing) throw new Error("CV no encontrado.");

  const { error } = await supabase
    .from("generated_cvs")
    .update({ content })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/applications/${existing.application_id}`);
}

// --- updateCoverLetter ---

const updateCoverLetterInput = z.object({
  id: z.string().uuid(),
  content: z.string().min(1),
});

export async function updateCoverLetter(
  input: z.infer<typeof updateCoverLetterInput>
) {
  const { id, content } = updateCoverLetterInput.parse(input);
  const { supabase } = await requireUser();

  const { data: existing, error: fetchError } = await supabase
    .from("cover_letters")
    .select("application_id")
    .eq("id", id)
    .single();

  if (fetchError || !existing) throw new Error("Cover letter no encontrada.");

  const { error } = await supabase
    .from("cover_letters")
    .update({ content })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/applications/${existing.application_id}`);
}
