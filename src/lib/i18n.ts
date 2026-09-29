import { Lang } from "@/lib/analyze/types";

// Interface copy. Report content arrives from the API already in both
// languages (see LocalizedText), so only the app's own chrome lives here.
const en = {
  appTitle: "Conversion Analyzer",
  subtitleLanding:
    "Paste any landing page URL. We score it on conversion readiness, SEO, GEO (AI search), text clarity, content efficiency and grammar.",
  subtitleCoaching:
    "Paste the sales page of an online coaching program, whether it sells the program directly or books a free call. We follow the CTA to the next step and check the offer, structure, proof, booking flow, SEO, GEO, clarity and grammar against the standards the top coaching businesses follow.",
  productLabel: "What are you analyzing?",
  // Product names: kept identical in every language.
  productLanding: "Landing page",
  productCoaching: "Evergreen",
  funnelLabel: "Funnel:",
  modeAuto: "Auto-detect",
  modeCall: "Free call / application",
  modeCheckout: "Direct purchase",
  placeholderLanding: "https://example.com/landing-page",
  placeholderCoaching: "https://yourcoaching.com/program",
  analyze: "Analyze",
  analyzing: "Analyzing…",
  loadingLanding: "Fetching the page and running SEO, GEO, clarity, grammar, and conversion checks…",
  loadingCoaching:
    "Fetching the page, following the CTA to the next step, and checking the offer, structure, proof, booking flow, SEO, GEO, clarity and grammar…",
  overallLanding: "Overall conversion readiness score",
  overallCoaching: "Overall coaching sales-page score",
  grade: "Grade",
  topRecommendations: "Top recommendations",
  networkError: "Network error — could not reach the analysis server.",
  genericError: "Something went wrong.",
  language: "Language",
  funnelFlow: "Funnel flow",
  funnelCall: "Free-call funnel",
  funnelCheckout: "Direct-purchase funnel",
  autoDetected: "auto-detected",
  chosenByYou: "chosen by you",
  step: "Step",
  leadersTitle: "How the leading free-call funnels do it",
  borrow: "Borrow:",
  blueprintCall: "Free-call page blueprint",
  blueprintCheckout: "Coaching sales-page blueprint",
  blueprintSubtitle: "The sections the leading pages of this funnel type share, in the order they usually appear.",
  sectionsSolid: (n: number, total: number) => `${n}/${total} sections solid`,
  statusPass: "Pass",
  statusWarn: "Needs attention",
  statusFail: "Fail",
  statusInfo: "Informational",
  open: "Open ↗",
};

type Dictionary = typeof en;

const it: Dictionary = {
  appTitle: "Analizzatore di conversione",
  subtitleLanding:
    "Incolla l'URL di una landing page. La valutiamo su predisposizione alla conversione, SEO, GEO (ricerca AI), chiarezza del testo, efficienza dei contenuti e grammatica.",
  subtitleCoaching:
    "Incolla la pagina di vendita di un programma di coaching online, sia che venda il programma direttamente sia che porti a una call gratuita. Seguiamo la CTA fino al passo successivo e verifichiamo offerta, struttura, prove, prenotazione, SEO, GEO, chiarezza e grammatica rispetto agli standard dei migliori business di coaching.",
  productLabel: "Cosa vuoi analizzare?",
  productLanding: "Landing page",
  productCoaching: "Evergreen",
  funnelLabel: "Funnel:",
  modeAuto: "Rileva automaticamente",
  modeCall: "Call gratuita / candidatura",
  modeCheckout: "Acquisto diretto",
  placeholderLanding: "https://esempio.it/landing-page",
  placeholderCoaching: "https://iltuocoaching.it/programma",
  analyze: "Analizza",
  analyzing: "Analisi in corso…",
  loadingLanding: "Scarico la pagina ed eseguo i controlli di SEO, GEO, chiarezza, grammatica e conversione…",
  loadingCoaching:
    "Scarico la pagina, seguo la CTA fino al passo successivo e verifico offerta, struttura, prove, prenotazione, SEO, GEO, chiarezza e grammatica…",
  overallLanding: "Punteggio complessivo di predisposizione alla conversione",
  overallCoaching: "Punteggio complessivo della pagina di coaching",
  grade: "Voto",
  topRecommendations: "Raccomandazioni principali",
  networkError: "Errore di rete: impossibile raggiungere il server di analisi.",
  genericError: "Qualcosa è andato storto.",
  language: "Lingua",
  funnelFlow: "Flusso del funnel",
  funnelCall: "Funnel a call gratuita",
  funnelCheckout: "Funnel di acquisto diretto",
  autoDetected: "rilevato automaticamente",
  chosenByYou: "scelto da te",
  step: "Passo",
  leadersTitle: "Come lo fanno i migliori funnel a call gratuita",
  borrow: "Da copiare:",
  blueprintCall: "Schema della pagina per call gratuita",
  blueprintCheckout: "Schema della pagina di vendita di coaching",
  blueprintSubtitle: "Le sezioni che le migliori pagine di questo tipo di funnel hanno in comune, nell'ordine in cui compaiono di solito.",
  sectionsSolid: (n: number, total: number) => `${n}/${total} sezioni solide`,
  statusPass: "Ok",
  statusWarn: "Da migliorare",
  statusFail: "Non superato",
  statusInfo: "Informativo",
  open: "Apri ↗",
};

export const DICTIONARIES: Record<Lang, Dictionary> = { en, it };
export type { Dictionary };
