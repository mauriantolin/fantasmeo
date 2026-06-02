export type GhostBand = "honesto" | "maquillado" | "fantasma" | "fantasma_total";

export const GHOST_BAND_LABELS: Record<GhostBand, string> = {
  honesto: "Honesto",
  maquillado: "Maquillado",
  fantasma: "Fantasma",
  fantasma_total: "Fantasma total",
};

export function getGhostBand(level: number): GhostBand {
  if (level < 0 || level > 100 || !Number.isFinite(level)) {
    throw new Error(`Ghost level must be between 0 and 100, got ${level}`);
  }
  if (level <= 25) return "honesto";
  if (level <= 50) return "maquillado";
  if (level <= 75) return "fantasma";
  return "fantasma_total";
}

const HARD_RULE =
  "HARD RULE — applies regardless of anything else: NEVER fabricate degrees, certifications, employer names, or employment dates. " +
  "Every employer, role, degree, and date in the output must exist in the base CV.";

const BAND_INSTRUCTIONS: Record<GhostBand, string> = {
  honesto: [
    "Adaptation level: HONEST (0-25).",
    "- Reorder and re-emphasize the existing content so the most relevant items for this job appear first.",
    "- Rewrite bullet points using the job description's keywords and vocabulary, but keep every fact exactly as it is.",
    "- You may omit irrelevant experience to keep the CV focused.",
    "- Do not add, exaggerate, or generalize anything.",
    HARD_RULE,
  ].join("\n"),
  maquillado: [
    "Adaptation level: POLISHED (26-50).",
    "- Everything from the HONEST level, plus:",
    "- Technologies or tools the candidate has merely touched can be presented as working experience.",
    "- Generalize role descriptions so they cover more of the job's requirements (e.g. 'worked on backend' can become 'designed and built backend services').",
    "- Round up partial experience (e.g. 1.5 years can read as '2 years').",
    HARD_RULE,
  ].join("\n"),
  fantasma: [
    "Adaptation level: GHOST (51-75).",
    "- Everything from the POLISHED level, plus:",
    "- Inflate seniority within the same role (e.g. 'developer' can become 'senior developer' if the dates plausibly support it).",
    "- Add plausible responsibilities and tasks the candidate could credibly have performed in their actual roles, especially ones matching the job requirements.",
    "- Present team contributions as personally led achievements.",
    HARD_RULE,
  ].join("\n"),
  fantasma_total: [
    "Adaptation level: FULL GHOST (76-100).",
    "- Everything from the GHOST level, pushed to the maximum defensible stretch:",
    "- Every requirement in the job description that could plausibly map to the candidate's real experience MUST appear covered in the CV.",
    "- Invent plausible projects, metrics, and achievements inside real jobs (with real employers and real dates) when they help match the job requirements.",
    "- The candidate must still be able to defend every line in an interview with good storytelling — nothing verifiable can be false.",
    HARD_RULE,
  ].join("\n"),
};

export function getGhostInstructions(level: number): string {
  return BAND_INSTRUCTIONS[getGhostBand(level)];
}
