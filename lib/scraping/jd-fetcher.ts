import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

export class ScrapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScrapeError";
  }
}

const MIN_JD_LENGTH = 200; // chars; shorter content means a login wall or block page

export function extractReadableText(html: string, url: string): string {
  const { document } = parseHTML(html);
  const reader = new Readability(document as unknown as Document, { charThreshold: 100 });
  const article = reader.parse();

  const text = (article?.textContent ?? "").replace(/\s+/g, " ").trim();

  if (text.length < MIN_JD_LENGTH) {
    throw new ScrapeError(
      `Could not extract a job description from ${url} (login wall or blocked).`
    );
  }
  return text;
}

export async function fetchJD(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
        "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ScrapeError("Could not reach the URL.");
  }

  if (!response.ok) {
    throw new ScrapeError(`Page responded with status ${response.status}.`);
  }

  const html = await response.text();
  return extractReadableText(html, url);
}
