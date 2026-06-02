import { generateText } from "ai";

import { AI_MODEL } from "@/lib/ai/client";
import type { CVContent, JDSummary } from "@/lib/types";

export async function generateCoverLetter(
  cv: CVContent,
  jd: JDSummary,
  jdText: string,
  ghostInstructions: string
): Promise<string> {
  const { text } = await generateText({
    model: AI_MODEL,
    prompt: [
      "Write a cover letter for this job application.",
      "",
      "Rules:",
      `- Write it in "${jd.language}" (the job description's language).`,
      "- 250-350 words, professional but warm tone, no clichés like 'I am writing to express my interest'.",
      "- Structure: hook tied to the company/role → 2 short paragraphs connecting the candidate's experience to the job's top requirements → closing with availability.",
      "- Use concrete facts from the CV below. The same truthfulness rules that produced this CV apply:",
      ghostInstructions,
      "- Output ONLY the letter body (no headers, no addresses, no 'Dear Hiring Manager' salutation in English if the letter is in Spanish — use the natural equivalent).",
      "",
      "TARGET JOB:",
      JSON.stringify(jd, null, 2),
      "",
      "FULL JOB DESCRIPTION:",
      jdText,
      "",
      "CANDIDATE CV:",
      JSON.stringify(cv, null, 2),
    ].join("\n"),
  });
  return text;
}
