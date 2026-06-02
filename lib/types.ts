export interface CVContact {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
}

export interface CVExperience {
  company: string;
  title: string;
  start: string; // "2023-01" or "2023"
  end: string | null; // null = present
  location?: string;
  bullets: string[];
}

export interface CVEducation {
  institution: string;
  degree: string;
  start?: string;
  end?: string;
}

export interface CVSkillGroup {
  category: string;
  items: string[];
}

export interface CVLanguage {
  name: string;
  level: string;
}

export interface CVCertification {
  name: string;
  issuer?: string;
  year?: string;
}

export interface CVContent {
  contact: CVContact;
  summary?: string;
  experience: CVExperience[];
  education: CVEducation[];
  skills: CVSkillGroup[];
  languages: CVLanguage[];
  certifications: CVCertification[];
}

export interface JDSummary {
  company: string;
  position: string;
  seniority?: string;
  required_skills: string[];
  nice_to_have: string[];
  keywords: string[];
  language: string; // ISO 639-1: "es", "en", ...
  summary: string;
}

export type ApplicationStatus =
  | "draft"
  | "applied"
  | "response_received"
  | "interview"
  | "offer"
  | "rejected"
  | "ghosted"
  | "withdrawn";

export type EventType =
  | "created"
  | "applied"
  | "cv_generated"
  | "cover_letter_generated"
  | "email_received"
  | "status_changed"
  | "note_added";

export type EmailClassificationType =
  | "rejection"
  | "interview"
  | "offer"
  | "info_request"
  | "other";

export interface EmailMatchResult {
  application_id: string | null;
  confidence: number; // 0-1
  classification: EmailClassificationType;
  summary: string; // one-line summary in Spanish for the timeline
}

export interface ApplicationEvent {
  id: string;
  type: EventType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
}

export interface ApplicationRow {
  id: string;
  company_name: string;
  position_title: string;
  platform: string;
  job_url: string | null;
  jd_text: string | null;
  jd_summary: JDSummary | null;
  status: ApplicationStatus;
  applied_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
