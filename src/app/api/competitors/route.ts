import { NextRequest, NextResponse } from "next/server";
import { AnalysisError } from "@/lib/analyze";
import { CompetitorAgentError, analyzeCompetitors } from "@/lib/analyze/competitors";
import { tr } from "@/lib/analyze/types";
import { COMPETITORS_ENABLED } from "@/lib/features";

// Web research plus three full page analyses: allow well over a minute.
export const maxDuration = 300;

const AGENT_ERRORS = {
  no_api_key: tr(
    "Competitor search needs an Anthropic API key. Add ANTHROPIC_API_KEY to .env.local and restart the server.",
    "La ricerca dei concorrenti richiede una chiave API Anthropic. Aggiungi ANTHROPIC_API_KEY a .env.local e riavvia il server."
  ),
  no_result: tr("No competitors could be identified for this page.", "Non è stato possibile identificare concorrenti per questa pagina."),
  refused: tr("The competitor search was declined for this page.", "La ricerca dei concorrenti è stata rifiutata per questa pagina."),
  api_error: tr(
    "The competitor search failed (AI service error). Try again in a moment.",
    "La ricerca dei concorrenti non è riuscita (errore del servizio AI). Riprova tra poco."
  ),
};

export async function POST(req: NextRequest) {
  if (!COMPETITORS_ENABLED) {
    return NextResponse.json(
      { error: tr("Competitor comparison is not available yet.", "Il confronto con i concorrenti non è ancora disponibile.") },
      { status: 403 }
    );
  }
  let body: { url?: string; product?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: tr("Invalid request body.", "Richiesta non valida.") }, { status: 400 });
  }
  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json({ error: tr("Missing 'url' field.", "Manca il campo 'url'.") }, { status: 400 });
  }

  try {
    const product = body.product === "landing" ? "landing" : "coaching";
    return NextResponse.json(await analyzeCompetitors(body.url, product));
  } catch (err) {
    if (err instanceof CompetitorAgentError) {
      console.error(`Competitor agent: ${err.code}: ${err.message}`);
      return NextResponse.json({ error: AGENT_ERRORS[err.code], code: err.code }, { status: err.code === "no_api_key" ? 503 : 502 });
    }
    if (err instanceof AnalysisError) {
      return NextResponse.json({ error: err.localized }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json(
      { error: tr("Something went wrong while comparing competitors.", "Si è verificato un errore durante il confronto con i concorrenti.") },
      { status: 500 }
    );
  }
}
