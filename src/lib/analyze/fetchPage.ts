import { PageData } from "./types";

export async function fetchPage(url: string): Promise<PageData> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CoachingPageAnalyzer/1.0; +https://example.com/bot)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const html = await res.text();
    return {
      url,
      finalUrl: res.url || url,
      status: res.status,
      html,
      fetchMs: Date.now() - started,
      sizeBytes: Buffer.byteLength(html, "utf8"),
    };
  } finally {
    clearTimeout(timeout);
  }
}
