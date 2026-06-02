import { generateText, Output } from "ai";
import { extractText, getDocumentProxy } from "unpdf";

import { cvContentSchema } from "@/lib/schemas";
import { AI_MODEL } from "@/lib/ai/client";
import type { CVContent } from "@/lib/types";

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

export async function parseCV(rawText: string): Promise<CVContent> {
  const { output } = await generateText({
    model: AI_MODEL,
    output: Output.object({ schema: cvContentSchema }),
    prompt: [
      "Extract the structured content of this CV/resume.",
      "Rules:",
      "- Keep the original language of the CV (do not translate).",
      "- Preserve every job, bullet point, skill, and date exactly as written.",
      "- Dates: use 'YYYY-MM' if month is known, else 'YYYY'. Use null for current positions.",
      "- Group skills into sensible categories if the CV does not group them.",
      "",
      "CV text:",
      rawText,
    ].join("\n"),
  });
  return output as CVContent;
}
