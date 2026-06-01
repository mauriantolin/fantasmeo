import { z } from "zod";

export const cvContentSchema = z.object({
  contact: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string().optional(),
    location: z.string().optional(),
    linkedin: z.string().optional(),
    website: z.string().optional(),
  }),
  summary: z.string().optional(),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      start: z.string(),
      end: z.string().nullable(),
      location: z.string().optional(),
      bullets: z.array(z.string()),
    })
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      start: z.string().optional(),
      end: z.string().optional(),
    })
  ),
  skills: z.array(
    z.object({ category: z.string(), items: z.array(z.string()) })
  ),
  languages: z.array(z.object({ name: z.string(), level: z.string() })),
  certifications: z.array(
    z.object({
      name: z.string(),
      issuer: z.string().optional(),
      year: z.string().optional(),
    })
  ),
});

export const jdSummarySchema = z.object({
  company: z.string(),
  position: z.string(),
  seniority: z.string().optional(),
  required_skills: z.array(z.string()),
  nice_to_have: z.array(z.string()),
  keywords: z.array(z.string()),
  language: z.string(),
  summary: z.string(),
});

export const emailMatchResultSchema = z.object({
  application_id: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  classification: z.enum([
    "rejection",
    "interview",
    "offer",
    "info_request",
    "other",
  ]),
  summary: z.string(),
});
