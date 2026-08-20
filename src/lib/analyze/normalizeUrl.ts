export class AnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisError";
  }
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new AnalysisError("Please enter a URL.");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let u: URL;
  try {
    u = new URL(withProtocol);
  } catch {
    throw new AnalysisError("That doesn't look like a valid URL.");
  }
  if (!u.hostname.includes(".") || !/^https?:$/.test(u.protocol)) {
    throw new AnalysisError("That doesn't look like a valid URL.");
  }
  return u.toString();
}
