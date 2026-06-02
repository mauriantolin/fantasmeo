import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { CVEditor } from "@/components/cv-editor";
import { cvContentSchema } from "@/lib/schemas";
import { updateCVContent } from "../actions";
import type { CVContent } from "@/lib/types";

export default async function CVDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: cv } = await supabase
    .from("base_cvs")
    .select("id, title, content")
    .eq("id", id)
    .single();

  if (!cv) notFound();

  // Validate the stored JSON conforms to the schema at read time
  const parsed = cvContentSchema.safeParse(cv.content);
  if (!parsed.success) notFound();

  const content: CVContent = parsed.data as CVContent;

  async function save(updated: CVContent) {
    "use server";
    await updateCVContent(id, updated);
  }

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-lg font-semibold">{cv.title}</h1>
      <CVEditor initialContent={content} onSave={save} />
    </div>
  );
}
