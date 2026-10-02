import { LocalizedText, tr } from "./types";

/** An error the user can act on; carries its message in every UI language. */
export class AnalysisError extends Error {
  readonly localized: LocalizedText;

  constructor(localized: LocalizedText) {
    super(localized.en);
    this.name = "AnalysisError";
    this.localized = localized;
  }
}

const INVALID_URL = tr("That doesn't look like a valid URL.", "Non sembra un URL valido.");

/**
 * Hostname-only check (no DNS resolution): loopback, private ranges, link-local,
 * and *.local / *.localhost names — i.e. pages you're running on your own machine
 * or network rather than something published on the internet.
 */
export function isLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "::1" || h === "::") return true;
  if (h.includes(":")) return /^(fc|fd|fe80)/.test(h);
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return (
    a === 0 ||
    a === 127 ||
    a === 10 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254)
  );
}

export function isLocalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "file:" || isLocalHostname(u.hostname);
  } catch {
    return false;
  }
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new AnalysisError(tr("Please enter a URL.", "Inserisci un URL."));

  let withProtocol = trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    // Local dev servers rarely have TLS, so default them to http://.
    let scheme = "https";
    try {
      if (isLocalHostname(new URL(`http://${trimmed}`).hostname)) scheme = "http";
    } catch {
      // fall through; the parse below reports the error
    }
    withProtocol = `${scheme}://${trimmed}`;
  }

  let u: URL;
  try {
    u = new URL(withProtocol);
  } catch {
    throw new AnalysisError(INVALID_URL);
  }
  if (!/^https?:$/.test(u.protocol) || (!u.hostname.includes(".") && !isLocalHostname(u.hostname))) {
    throw new AnalysisError(INVALID_URL);
  }
  return u.toString();
}
