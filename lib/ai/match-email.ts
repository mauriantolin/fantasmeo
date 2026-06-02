import { generateText, Output } from "ai";
import { emailMatchResultSchema } from "@/lib/schemas";
import { AI_MODEL } from "@/lib/ai/client";
import type { EmailMatchResult } from "@/lib/types";

interface ApplicationContext {
  id: string;
  company_name: string;
  position_title: string;
  platform: string;
  status: string;
  applied_at: string | null;
}

export async function matchEmail(
  email: { from: string; subject: string; body: string; receivedAt: string },
  applications: ApplicationContext[]
): Promise<EmailMatchResult> {
  const { output } = await generateText({
    model: AI_MODEL,
    output: Output.object({ schema: emailMatchResultSchema }),
    prompt: [
      "You are matching an incoming email against a list of job applications the user is tracking.",
      "",
      "Determine:",
      "1. Which application (if any) this email is about. Return its id, or null if none match.",
      "2. Your confidence (0-1). Use >0.8 only when the company or position is explicitly referenced.",
      "3. The classification:",
      "   - 'rejection': the email rejects the candidate",
      "   - 'interview': invitation to interview, screening call, or technical test",
      "   - 'offer': a job offer or contract discussion",
      "   - 'info_request': recruiter asks for documents, availability, salary expectations, etc.",
      "   - 'other': related to the application but none of the above",
      "4. A one-line summary IN SPANISH of what the email says (for the application timeline).",
      "",
      "Important: automated marketing from job platforms ('jobs you may like') is NOT about a specific application — return null with classification 'other'.",
      "",
      "TRACKED APPLICATIONS:",
      JSON.stringify(applications, null, 2),
      "",
      "EMAIL:",
      JSON.stringify(email, null, 2),
    ].join("\n"),
  });
  return output as EmailMatchResult;
}
