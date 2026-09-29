import { NextRequest, NextResponse } from "next/server";
import { AnalysisError, analyzePage } from "@/lib/analyze";
import { tr } from "@/lib/analyze/types";
import { sessionEmail } from "@/lib/auth/session";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!sessionEmail(req)) {
    return NextResponse.json({ error: tr("Please sign in.", "Accedi per continuare.") }, { status: 401 });
  }
  let body: { url?: string; mode?: string; product?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: tr("Invalid request body.", "Richiesta non valida.") }, { status: 400 });
  }

  const url = body.url;
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: tr("Missing 'url' field.", "Manca il campo 'url'.") }, { status: 400 });
  }

  try {
    const product = body.product === "landing" ? "landing" : "coaching";
    const mode = body.mode === "call" || body.mode === "checkout" ? body.mode : "auto";
    const report = await analyzePage(url, { product, mode });
    return NextResponse.json(report);
  } catch (err) {
    if (err instanceof AnalysisError) {
      return NextResponse.json({ error: err.localized }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json(
      {
        error: tr(
          "Something went wrong while analyzing the page.",
          "Si è verificato un errore durante l'analisi della pagina."
        ),
      },
      { status: 500 }
    );
  }
}
