import { NextRequest, NextResponse } from "next/server";
import { sessionEmail } from "@/lib/auth/session";

// Everything except the sign-in page/endpoint and static assets requires a
// session. API routes also check the session themselves (defense in depth:
// a matcher change must not silently open them up).
export function proxy(request: NextRequest) {
  if (sessionEmail(request)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: { en: "Please sign in.", it: "Accedi per continuare." } }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (request.nextUrl.pathname !== "/") login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico).*)"],
};
