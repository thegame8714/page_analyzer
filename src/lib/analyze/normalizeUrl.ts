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

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new AnalysisError(tr("Please enter a URL.", "Inserisci un URL."));
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let u: URL;
  try {
    u = new URL(withProtocol);
  } catch {
    throw new AnalysisError(INVALID_URL);
  }
  if (!u.hostname.includes(".") || !/^https?:$/.test(u.protocol)) {
    throw new AnalysisError(INVALID_URL);
  }
  return u.toString();
}
