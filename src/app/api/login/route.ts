import { NextRequest, NextResponse } from "next/server";
import { AuthConfigError, SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, isAllowed } from "@/lib/auth/session";
import { tr } from "@/lib/analyze/types";

export async function POST(req: NextRequest) {
  let email: unknown;
  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ error: tr("Invalid request.", "Richiesta non valida.") }, { status: 400 });
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: tr("Enter a valid email address.", "Inserisci un indirizzo email valido.") }, { status: 400 });
  }
  if (!isAllowed(email)) {
    return NextResponse.json(
      { error: tr("This email doesn't have access.", "Questa email non ha accesso.") },
      { status: 403 }
    );
  }

  let token: string;
  try {
    token = createSessionToken(email);
  } catch (err) {
    if (err instanceof AuthConfigError) {
      console.error(err.message);
      return NextResponse.json(
        { error: tr("Sign-in isn't configured on the server yet.", "L'accesso non è ancora configurato sul server.") },
        { status: 500 }
      );
    }
    throw err;
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
