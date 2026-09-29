import { loadHtml } from "./dom";
import { fetchPage } from "./fetchPage";
import { analyzeSeo } from "./seo";
import { analyzeGeo } from "./geo";
import { analyzeClarity } from "./clarity";
import { analyzeEfficiency } from "./efficiency";
import { analyzeGrammar } from "./grammar";
import { analyzeConversion } from "./conversion";
import { analyzeLandingConversion } from "./landing/conversion";
import { CoachingContext, buildContext } from "./coaching/context";
import { BookingStep, analyzeCallFunnel, detectFunnel, funnelInfo, resolveNextStep } from "./coaching/callFunnel";
import { analyzeOffer } from "./coaching/offer";
import { analyzeFramework } from "./coaching/framework";
import { analyzeTrust } from "./coaching/trust";
import { STANDARDS } from "./coaching/standards";
import {
  AnalysisReport,
  BlueprintSection,
  CategoryResult,
  FunnelMode,
  FunnelType,
  LocalizedText,
  PageData,
  Product,
  Recommendation,
  gradeFromScore,
  tr,
} from "./types";
import { AnalysisError, normalizeUrl } from "./normalizeUrl";

export { AnalysisError, normalizeUrl } from "./normalizeUrl";

// ---- Landing page (general) ------------------------------------------------------

const LANDING_WEIGHTS: Record<string, number> = {
  conversion: 1.3,
  seo: 1,
  geo: 1,
  clarity: 1,
  efficiency: 1,
  grammar: 0.8,
};

// ---- Coaching program --------------------------------------------------------------

// Coaching is a high-trust, high-consideration purchase: the offer, the
// sales-page arc and the proof decide the sale far more than technical SEO.
const COACHING_WEIGHTS: Record<string, number> = {
  callFunnel: 1.4,
  offer: 1.4,
  framework: 1.3,
  trust: 1.3,
  conversion: 1,
  clarity: 0.9,
  seo: 0.7,
  geo: 0.7,
  efficiency: 0.7,
  grammar: 0.8,
};

// Findings from the generic categories get tagged with the standard they're
// benchmarked against, unless they already carry a more specific one.
const DEFAULT_STANDARDS: Record<string, LocalizedText> = {
  seo: STANDARDS.searchEssentials,
  geo: STANDARDS.geo,
  clarity: STANDARDS.copywriting,
  efficiency: STANDARDS.cro,
};

// The canonical sections of each funnel type, in the order the leading pages
// present them, mapped to the finding that detects each one.
type BlueprintEntry = { id: string; label: LocalizedText; category: string; finding: string };

const CHECKOUT_BLUEPRINT: BlueprintEntry[] = [
  { id: "hook", label: tr("Outcome headline", "Titolo sul risultato"), category: "framework", finding: "headline-outcome" },
  { id: "avatar", label: tr("Who it's for", "Per chi è"), category: "framework", finding: "who-for" },
  { id: "pain", label: tr("Pain & problem", "Dolore e problema"), category: "framework", finding: "pain" },
  { id: "vision", label: tr("After-state vision", "Visione del \"dopo\""), category: "framework", finding: "vision" },
  { id: "coach", label: tr("Meet the coach", "Chi è il coach"), category: "framework", finding: "coach-story" },
  { id: "curriculum", label: tr("Curriculum / roadmap", "Programma / roadmap"), category: "offer", finding: "curriculum" },
  { id: "deliverables", label: tr("What's included", "Cosa è incluso"), category: "offer", finding: "deliverables" },
  { id: "proof", label: tr("Results testimonials", "Testimonianze con risultati"), category: "trust", finding: "results-testimonials" },
  { id: "stack", label: tr("Value stack", "Stack del valore"), category: "offer", finding: "value-stack" },
  { id: "bonuses", label: tr("Bonuses", "Bonus"), category: "offer", finding: "bonuses" },
  { id: "price", label: tr("Price / apply", "Prezzo / candidatura"), category: "offer", finding: "pricing" },
  { id: "guarantee", label: tr("Guarantee", "Garanzia"), category: "offer", finding: "guarantee" },
  { id: "urgency", label: tr("Urgency", "Urgenza"), category: "framework", finding: "urgency" },
  { id: "faq", label: tr("FAQ & objections", "FAQ e obiezioni"), category: "framework", finding: "faq" },
  { id: "not-for", label: tr("Not for you if…", "Non è per te se…"), category: "framework", finding: "not-for" },
  { id: "cta", label: tr("Repeated CTA", "CTA ripetuta"), category: "framework", finding: "cta-repetition" },
];

// Modeled on Tony Robbins Results Coaching, Clients on Demand, Jay Shetty
// Certification and Consulting.com.
const CALL_BLUEPRINT: BlueprintEntry[] = [
  { id: "hook", label: tr("Outcome headline", "Titolo sul risultato"), category: "framework", finding: "headline-outcome" },
  { id: "avatar", label: tr("Who it's for", "Per chi è"), category: "framework", finding: "who-for" },
  { id: "pain", label: tr("Pain & problem", "Dolore e problema"), category: "framework", finding: "pain" },
  { id: "vision", label: tr("After-state vision", "Visione del \"dopo\""), category: "framework", finding: "vision" },
  { id: "coach", label: tr("Meet the coach", "Chi è il coach"), category: "framework", finding: "coach-story" },
  { id: "how", label: tr("How it works (steps)", "Come funziona (passi)"), category: "callFunnel", finding: "how-it-works" },
  { id: "proof", label: tr("Results testimonials", "Testimonianze con risultati"), category: "trust", finding: "results-testimonials" },
  { id: "call-named", label: tr("Named call offer", "Call con un nome"), category: "callFunnel", finding: "call-named" },
  { id: "call-free", label: tr("Free, with length", "Gratuita, con durata"), category: "callFunnel", finding: "call-free" },
  { id: "takeaway", label: tr("What you get on the call", "Cosa ottieni dalla call"), category: "callFunnel", finding: "call-takeaway" },
  { id: "no-pressure", label: tr("No-pressure promise", "Promessa \"senza pressioni\""), category: "callFunnel", finding: "no-pressure" },
  { id: "scarcity", label: tr("Qualification / limited spots", "Selezione / posti limitati"), category: "callFunnel", finding: "qualification-scarcity" },
  { id: "faq", label: tr("FAQ (incl. price)", "FAQ (anche sul prezzo)"), category: "framework", finding: "faq" },
  { id: "cta", label: tr("CTAs name the call", "Le CTA nominano la call"), category: "callFunnel", finding: "cta-names-call" },
  { id: "booking", label: tr("1-click booking step", "Prenotazione in 1 clic"), category: "callFunnel", finding: "clicks-to-book" },
  { id: "qualify", label: tr("Qualifying questions", "Domande di qualificazione"), category: "callFunnel", finding: "qualifying-questions" },
];

function buildBlueprint(categories: CategoryResult[], funnel: FunnelType): BlueprintSection[] {
  return (funnel === "call" ? CALL_BLUEPRINT : CHECKOUT_BLUEPRINT).flatMap((b) => {
    const f = categories.find((c) => c.key === b.category)?.findings.find((x) => x.id === b.finding);
    return f ? [{ id: b.id, label: b.label, status: f.status }] : [];
  });
}

/**
 * B-School-style flows put the full offer (curriculum, stack, price,
 * guarantee) on the page the CTA opens, not on the teaser page. Merge the two
 * so offer/structure/trust checks see the whole sales argument.
 */
function mergeWithNextPage(ctx: CoachingContext, next: BookingStep): CoachingContext | null {
  if (next.kind !== "page" || !next.$step || !next.scopeHtml) return null;
  const $n = next.$step;
  const merged = `<html lang="${ctx.$("html").attr("lang") ?? ""}"><head>${ctx.$("head").html() ?? ""}</head><body>${
    ctx.$("body").html() ?? ""
  }${$n("body").html() ?? ""}</body></html>`;
  return buildContext(loadHtml(merged), `${ctx.html}\n${next.scopeHtml}`, ctx.finalUrl);
}

// In a call funnel the page sells the call, not the program, so the program
// offer counts for less and the call funnel carries the weight instead.
function coachingWeights(funnel: FunnelType): Record<string, number> {
  return funnel === "call" ? { ...COACHING_WEIGHTS, offer: 0.9 } : COACHING_WEIGHTS;
}

// ---- Shared ---------------------------------------------------------------------------

/** Coaching ranking: a fail counts double, and findings in categories that
 * drive coaching sales outrank technical ones. */
function rankedRecommendations(categories: CategoryResult[], weights: Record<string, number>): Recommendation[] {
  return categories
    .flatMap((c) =>
      c.findings
        .filter((f) => f.status === "fail" || f.status === "warn")
        .map((f) => ({
          category: c.name,
          detail: f.detail,
          priority: f.weight * (f.status === "fail" ? 2 : 1) * (weights[c.key] ?? 1),
        }))
    )
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10)
    .map(({ category, detail }) => ({ category, detail }));
}

/** Original landing-page ranking: every fail before any warn, then by weight. */
function landingRecommendations(categories: CategoryResult[]): Recommendation[] {
  const pick = (status: "fail" | "warn") =>
    categories.flatMap((c) => c.findings.filter((f) => f.status === status).map((f) => ({ category: c.name, detail: f.detail, weight: f.weight })));
  return [...pick("fail"), ...pick("warn")]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8)
    .map(({ category, detail }) => ({ category, detail }));
}

function weightedScore(categories: CategoryResult[], weights: Record<string, number>): number {
  const total = categories.reduce((sum, c) => sum + (weights[c.key] ?? 1), 0);
  return Math.round(categories.reduce((sum, c) => sum + c.score * (weights[c.key] ?? 1), 0) / total);
}

export async function loadPage(rawUrl: string): Promise<{ url: string; page: PageData }> {
  const url = normalizeUrl(rawUrl);
  let page;
  try {
    page = await fetchPage(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new AnalysisError(
      tr(
        `Could not fetch that URL (${message}). Check that it's publicly accessible and try again.`,
        `Impossibile scaricare l'URL (${message}). Verifica che sia accessibile pubblicamente e riprova.`
      )
    );
  }
  if (page.status >= 400) {
    throw new AnalysisError(tr(`The page responded with HTTP ${page.status}.`, `La pagina ha risposto con HTTP ${page.status}.`));
  }
  if (!page.html || page.html.trim().length === 0) {
    throw new AnalysisError(tr("The page returned no HTML content to analyze.", "La pagina non ha restituito contenuto HTML da analizzare."));
  }
  return { url, page };
}

export interface AnalyzeOptions {
  product: Product;
  /** Coaching only: which funnel the page runs ("auto" detects it). */
  mode?: FunnelMode;
}

export async function analyzePage(rawUrl: string, { product, mode = "auto" }: AnalyzeOptions): Promise<AnalysisReport> {
  const { url, page } = await loadPage(rawUrl);
  const $ = loadHtml(page.html);
  const base = { product, url, finalUrl: page.finalUrl, fetchedAt: new Date().toISOString() };

  const [geo, grammar] = await Promise.all([analyzeGeo($, page.finalUrl, product), analyzeGrammar($, page.finalUrl)]);
  const seo = analyzeSeo($, page.finalUrl, product);
  const clarity = analyzeClarity($);
  const efficiency = analyzeEfficiency($, page.sizeBytes);

  if (product === "landing") {
    const conversion = analyzeLandingConversion($, page.sizeBytes, page.fetchMs);
    const categories = [conversion, seo, geo, clarity, efficiency, grammar];
    const overallScore = weightedScore(categories, LANDING_WEIGHTS);
    return {
      ...base,
      overallScore,
      overallGrade: gradeFromScore(overallScore),
      categories,
      topRecommendations: landingRecommendations(categories),
    };
  }

  const ctx = buildContext($, page.html, page.finalUrl);
  const detection = detectFunnel(ctx, mode);
  const next = await resolveNextStep(ctx, detection);

  let salesCtx = ctx;
  if (detection.type === "checkout") {
    const merged = mergeWithNextPage(ctx, next);
    if (merged) {
      salesCtx = merged;
      next.steps[next.steps.length - 1]?.notes.push(
        tr("included in the Offer / Structure / Trust analysis", "inclusa nell'analisi di Offerta / Struttura / Fiducia")
      );
    }
  }

  const offer = analyzeOffer(salesCtx, detection.type);
  const framework = analyzeFramework(salesCtx);
  const trust = analyzeTrust(salesCtx);
  const conversion = analyzeConversion(ctx, page.sizeBytes, page.fetchMs);

  const categories =
    detection.type === "call"
      ? [analyzeCallFunnel(ctx, next), offer, framework, trust, conversion, clarity, seo, geo, efficiency, grammar]
      : [offer, framework, trust, conversion, clarity, seo, geo, efficiency, grammar];
  for (const c of categories) {
    const fallback = DEFAULT_STANDARDS[c.key];
    if (fallback) for (const f of c.findings) f.standard ??= fallback;
  }

  const weights = coachingWeights(detection.type);
  const overallScore = weightedScore(categories, weights);
  return {
    ...base,
    overallScore,
    overallGrade: gradeFromScore(overallScore),
    categories,
    topRecommendations: rankedRecommendations(categories, weights),
    blueprint: buildBlueprint(categories, detection.type),
    funnel: funnelInfo(detection, mode, next),
  };
}
