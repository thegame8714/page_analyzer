import { createHmac, timingSafeEqual } from "node:crypto";

// Access control: a visitor enters their email on /login; if it's in
// ALLOWED_EMAILS they get a signed session cookie. The list lives in the
// environment (not the repo) so the allowed addresses aren't published.
//
// Note: this checks that the email is on the list, not that the visitor owns
// it — anyone who knows an allowed address can sign in with it.

export const SESSION_COOKIE = "pa_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

export class AuthConfigError extends Error {}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function allowedEmails(): Set<string> {
  return new Set(
    (process.env.ALLOWED_EMAILS ?? "")
      .split(/[,;\s]+/)
      .map(normalizeEmail)
      .filter(Boolean)
  );
}

export function isAllowed(email: string): boolean {
  return allowedEmails().has(normalizeEmail(email));
}

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new AuthConfigError("AUTH_SECRET must be set to a random string of at least 32 characters.");
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Token format: base64url(email|expiresAt).signature */
export function createSessionToken(email: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = Buffer.from(`${normalizeEmail(email)}|${expiresAt}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the signed-in email, or null if the token is missing, forged,
 * expired, or the email has since been removed from the allowlist. */
export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const [email, expiresAt] = Buffer.from(payload, "base64url").toString().split("|");
  if (!email || !(Number(expiresAt) > Date.now() / 1000)) return null;
  return isAllowed(email) ? email : null;
}

/** For route handlers: the signed-in email from the request's cookie. */
export function sessionEmail(req: { cookies: { get(name: string): { value: string } | undefined } }): string | null {
  try {
    return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  } catch (err) {
    if (err instanceof AuthConfigError) return null;
    throw err;
  }
}
