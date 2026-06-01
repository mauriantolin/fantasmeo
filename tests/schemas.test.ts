import { describe, it, expect } from "vitest";
import { cvContentSchema, jdSummarySchema, emailMatchResultSchema } from "@/lib/schemas";

describe("cvContentSchema", () => {
  it("accepts a valid CV", () => {
    const valid = {
      contact: { name: "Jane Doe", email: "jane@example.com" },
      experience: [
        {
          company: "Acme",
          title: "Engineer",
          start: "2022-01",
          end: null,
          bullets: ["Built things"],
        },
      ],
      education: [{ institution: "UBA", degree: "Ingeniería" }],
      skills: [{ category: "Languages", items: ["TypeScript"] }],
      languages: [{ name: "Spanish", level: "Native" }],
      certifications: [],
    };
    expect(cvContentSchema.parse(valid)).toEqual(valid);
  });

  it("rejects a CV missing contact.name", () => {
    expect(() =>
      cvContentSchema.parse({ contact: { email: "x@y.z" }, experience: [], education: [], skills: [], languages: [], certifications: [] })
    ).toThrow();
  });
});

describe("emailMatchResultSchema", () => {
  it("rejects confidence > 1", () => {
    expect(() =>
      emailMatchResultSchema.parse({ application_id: null, confidence: 1.5, classification: "other", summary: "x" })
    ).toThrow();
  });

  it("accepts a valid match", () => {
    const valid = { application_id: "abc", confidence: 0.9, classification: "interview", summary: "Te invitan a entrevista" };
    expect(emailMatchResultSchema.parse(valid)).toEqual(valid);
  });
});

describe("jdSummarySchema", () => {
  it("accepts a valid JD summary", () => {
    const valid = {
      company: "Globant",
      position: "SSr Backend Developer",
      required_skills: ["Node.js"],
      nice_to_have: [],
      keywords: ["nodejs", "aws"],
      language: "es",
      summary: "Backend role",
    };
    expect(jdSummarySchema.parse(valid)).toEqual(valid);
  });
});
