import { generateText, Output } from "ai";

import { jdSummarySchema } from "@/lib/schemas";
import { AI_MODEL } from "@/lib/ai/client";
import type { JDSummary } from "@/lib/types";

export async function parseJD(jdText: string, sourceUrl?: string): Promise<JDSummary> {
  const { output } = await generateText({
    model: AI_MODEL,
    output: Output.object({ schema: jdSummarySchema }),
    prompt: [
      "Analyze this job description and extract structured information.",
      "Rules:",
      "- 'language' is the ISO 639-1 code of the language the JD is written in (e.g. 'es', 'en').",
      "- 'required_skills' are hard requirements; 'nice_to_have' are desirable extras.",
      "- 'keywords' are ATS-relevant terms (technologies, methodologies, certifications) found in the JD.",
      "- 'summary' is a 2-3 sentence overview of the role, written in the same language as the JD.",
      "- 'seniority' examples: junior, semi-senior, senior, lead, manager.",
      sourceUrl ? `- Source URL (may hint at company/platform): ${sourceUrl}` : "",
      "",
      "Job description:",
      jdText,
    ].join("\n"),
  });
  return output as JDSummary;
}
