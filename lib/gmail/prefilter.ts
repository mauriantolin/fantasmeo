interface EmailSummary {
  from: string;
  subject: string;
  body: string;
}

interface TrackedApplication {
  id: string;
  company_name: string;
  position_title: string;
}

// Senders from recruiting platforms are always relevant candidates
const RECRUITING_DOMAINS = [
  "linkedin.com", "greenhouse.io", "lever.co", "workday.com", "myworkday.com",
  "smartrecruiters.com", "ashbyhq.com", "breezy.hr", "bamboohr.com",
  "indeed.com", "glassdoor.com", "talent.com", "workable.com", "icims.com",
  "jobvite.com", "recruitee.com", "teamtailor.com", "personio.de", "personio.com",
];

function normalize(s: string): string {
  // strip combining diacritical marks (U+0300–U+036F) after NFD decomposition
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function isLikelyRelevant(
  email: EmailSummary,
  applications: TrackedApplication[]
): boolean {
  const haystack = normalize(`${email.from} ${email.subject} ${email.body.slice(0, 2000)}`);
  const fromDomain = email.from.split("@").pop() ?? "";

  if (RECRUITING_DOMAINS.some((domain) => fromDomain.includes(domain))) {
    return true;
  }

  return applications.some((app) => {
    const company = normalize(app.company_name);
    // company name as a word (avoid "meta" matching "metadata")
    const companyRegex = new RegExp(`\\b${company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    return companyRegex.test(haystack);
  });
}
