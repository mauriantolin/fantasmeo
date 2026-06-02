import { describe, it, expect } from "vitest";
import { extractReadableText, ScrapeError } from "@/lib/scraping/jd-fetcher";

describe("extractReadableText", () => {
  it("extracts the main text from an HTML document", () => {
    const html = `<html><head><title>Job</title></head><body>
      <nav>Menu Home About</nav>
      <article><h1>Backend Developer</h1>
      <p>We are looking for a backend developer with Node.js experience.
      You will build APIs and work with PostgreSQL databases every day.
      The role requires five years of experience and strong communication skills.</p></article>
      <footer>Copyright</footer></body></html>`;
    const text = extractReadableText(html, "https://example.com/job/1");
    expect(text).toContain("backend developer with Node.js");
    expect(text).not.toContain("Copyright");
  });

  it("throws ScrapeError when content is too short to be a JD", () => {
    const html = `<html><body><div>Sign in to view this job</div></body></html>`;
    expect(() => extractReadableText(html, "https://example.com/blocked")).toThrow(ScrapeError);
  });
});
