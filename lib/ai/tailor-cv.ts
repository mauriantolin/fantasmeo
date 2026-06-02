import { generateText, Output } from "ai";

import { cvContentSchema } from "@/lib/schemas";
import { AI_MODEL } from "@/lib/ai/client";
import { getGhostInstructions } from "@/lib/ai/ghost-level";
import type { CVContent, JDSummary } from "@/lib/types";

export async function tailorCV(
  baseCV: CVContent,
  jd: JDSummary,
  jdText: string,
  ghostLevel: number
): Promise<CVContent> {
  const { output } = await generateText({
    model: AI_MODEL,
    output: Output.object({ schema: cvContentSchema }),
    prompt: [
      "You are an expert CV writer. Adapt the candidate's base CV to maximize fit with the target job.",
      "",
      getGhostInstructions(ghostLevel),
      "",
      `Output language: write the ENTIRE CV in "${jd.language}" (the job description's language). Translate content if needed.`,
      "Keep the same JSON structure. Contact info is copied verbatim (never translated or altered).",
      "Order experience bullets by relevance to this job. Aim for 3-5 strong bullets per recent role.",
      "The skills section should lead with the skills this job asks for (among those the adaptation level allows).",
      "",
      "TARGET JOB SUMMARY:",
      JSON.stringify(jd, null, 2),
      "",
      "FULL JOB DESCRIPTION:",
      jdText,
      "",
      "BASE CV:",
      JSON.stringify(baseCV, null, 2),
    ].join("\n"),
  });
  return output as CVContent;
}
