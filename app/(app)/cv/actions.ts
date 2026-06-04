"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { cvContentSchema } from "@/lib/schemas";
import { extractPdfText, parseCV } from "@/lib/ai/parse-cv";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const uploadFormSchema = z.object({
  title: z.string().min(1),
  language: z.enum(["es", "en"]),
});

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function uploadAndParseCV(formData: FormData) {
  const { supabase, user } = await getAuthenticatedUser();

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided");
  if (file.size > MAX_FILE_SIZE) throw new Error("File too large (max 5 MB)");

  const parsed = uploadFormSchema.parse({
    title: formData.get("title"),
    language: formData.get("language"),
  });

  const filePath = `${user.id}/${crypto.randomUUID()}.pdf`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("cv-uploads")
    .upload(filePath, buffer, { contentType: "application/pdf" });
  if (uploadError) throw uploadError;

  const rawText = await extractPdfText(buffer);
  const content = await parseCV(rawText);

  const { data: row, error: insertError } = await supabase
    .from("base_cvs")
    .insert({
      user_id: user.id,
      title: parsed.title,
      language: parsed.language,
      raw_file_path: filePath,
      content,
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  revalidatePath("/cv");
  // Navigate client-side so the server redirect doesn't surface as a caught
  // error in the caller's try/catch.
  return { id: row.id as string };
}

export async function updateCVContent(id: string, content: unknown) {
  z.string().uuid().parse(id);
  const { supabase } = await getAuthenticatedUser();

  const validated = cvContentSchema.parse(content);

  const { error } = await supabase
    .from("base_cvs")
    .update({ content: validated })
    .eq("id", id);
  if (error) throw error;

  revalidatePath(`/cv/${id}`);
}

const toggleActiveSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

export async function toggleCVActive(id: string, isActive: boolean) {
  const { supabase } = await getAuthenticatedUser();

  const validated = toggleActiveSchema.parse({ id, isActive });

  const { error } = await supabase
    .from("base_cvs")
    .update({ is_active: validated.isActive })
    .eq("id", validated.id);
  if (error) throw error;

  revalidatePath("/cv");
}

export async function deleteCV(id: string) {
  z.string().uuid().parse(id);
  const { supabase } = await getAuthenticatedUser();

  const { data: row, error: fetchError } = await supabase
    .from("base_cvs")
    .select("raw_file_path")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;

  await supabase.storage.from("cv-uploads").remove([row.raw_file_path]);

  const { error } = await supabase.from("base_cvs").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/cv");
}
