import { describe, it, expect } from "vitest";
import { isLikelyRelevant } from "@/lib/gmail/prefilter";

const applications = [
  { id: "1", company_name: "Globant", position_title: "Backend Developer" },
  { id: "2", company_name: "MercadoLibre", position_title: "SSr Engineer" },
];

describe("isLikelyRelevant", () => {
  it("accepts an email mentioning a tracked company in the sender", () => {
    expect(
      isLikelyRelevant(
        { from: "talent@globant.com", subject: "Your application", body: "Hi! Thanks for applying" },
        applications
      )
    ).toBe(true);
  });

  it("accepts an email mentioning a tracked company in the subject", () => {
    expect(
      isLikelyRelevant(
        { from: "noreply@greenhouse.io", subject: "Update on your MercadoLibre application", body: "..." },
        applications
      )
    ).toBe(true);
  });

  it("accepts recruiting-platform senders even without a company match", () => {
    expect(
      isLikelyRelevant(
        { from: "jobs-noreply@linkedin.com", subject: "Your application was viewed", body: "..." },
        applications
      )
    ).toBe(true);
  });

  it("rejects newsletters and unrelated email", () => {
    expect(
      isLikelyRelevant(
        { from: "newsletter@medium.com", subject: "Top 10 articles this week", body: "..." },
        applications
      )
    ).toBe(false);
  });
});
