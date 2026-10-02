import { isLocalUrl } from "./normalizeUrl";
import { PageData } from "./types";

const MAX_REDIRECTS = 5;

/**
 * Local/private targets (localhost, LAN IPs) are what you want when testing a
 * page before deploying it — but on a publicly deployed instance they'd let
 * anyone make the server fetch its own internal network (SSRF). So they're on
 * by default in development and the CLI, and off in production unless
 * ALLOW_LOCAL_URLS=1 is set.
 */
export function localTargetsAllowed(): boolean {
  return process.env.ALLOW_LOCAL_URLS === "1" || process.env.NODE_ENV !== "production";
}

function assertAllowed(url: string) {
  if (!localTargetsAllowed() && isLocalUrl(url)) {
    throw new Error(
      "local and private addresses are disabled on this deployment (set ALLOW_LOCAL_URLS=1 to enable them)"
    );
  }
}

export async function fetchPage(url: string): Promise<PageData> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    // Follow redirects by hand so every hop is checked — otherwise a public
    // URL could redirect the server into a local/private address.
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      assertAllowed(current);
      const res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; LandingPageAnalyzer/1.0; +https://example.com/bot)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        current = new URL(location, current).toString();
        continue;
      }
      const html = await res.text();
      return {
        url,
        finalUrl: current,
        status: res.status,
        html,
        fetchMs: Date.now() - started,
        sizeBytes: Buffer.byteLength(html, "utf8"),
      };
    }
    throw new Error("too many redirects");
  } finally {
    clearTimeout(timeout);
  }
}
