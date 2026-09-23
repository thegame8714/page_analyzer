import { loadHtml } from "./dom";
import { fetchPage } from "./fetchPage";
import { analyzeSeo } from "./seo";
import { analyzeGeo } from "./geo";
import { analyzeClarity } from "./clarity";
import { analyzeEfficiency } from "./efficiency";
import { analyzeGrammar } from "./grammar";
import { analyzeConversion } from "./conversion";
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
  gradeFromScore,
} from "./types";
import { AnalysisError, normalizeUrl } from "./normalizeUrl";

export { AnalysisError, normalizeUrl } from "./normalizeUrl";

// Coaching is a high-trust, high-consideration purchase: the offer, the
// sales-page arc and the proof decide the sale far more than technical SEO.
const CATEGORY_WEIGHTS: Record<string, number> = {
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
const DEFAULT_STANDARDS: Record<string, string> = {
  seo: STANDARDS.searchEssentials,
  geo: STANDARDS.geo,
  clarity: STANDARDS.copywriting,
  efficiency: STANDARDS.cro,
};

// The canonical sections of each funnel type, in the order the leading pages
// present them, mapped to the finding that detects each one.
type BlueprintEntry = { id: string; label: string; category: string; finding: string };

const CHECKOUT_BLUEPRINT: BlueprintEntry[] = [
  { id: "hook", label: "Outcome headline", category: "framework", finding: "headline-outcome" },
  { id: "avatar", label: "Who it's for", category: "framework", finding: "who-for" },
  { id: "pain", label: "Pain & problem", category: "framework", finding: "pain" },
  { id: "vision", label: "After-state vision", category: "framework", finding: "vision" },
  { id: "coach", label: "Meet the coach", category: "framework", finding: "coach-story" },
  { id: "curriculum", label: "Curriculum / roadmap", category: "offer", finding: "curriculum" },
  { id: "deliverables", label: "What's included", category: "offer", finding: "deliverables" },
  { id: "proof", label: "Results testimonials", category: "trust", finding: "results-testimonials" },
  { id: "stack", label: "Value stack", category: "offer", finding: "value-stack" },
  { id: "bonuses", label: "Bonuses", category: "offer", finding: "bonuses" },
  { id: "price", label: "Price / apply", category: "offer", finding: "pricing" },
  { id: "guarantee", label: "Guarantee", category: "offer", finding: "guarantee" },
  { id: "urgency", label: "Urgency", category: "framework", finding: "urgency" },
  { id: "faq", label: "FAQ & objections", category: "framework", finding: "faq" },
  { id: "not-for", label: "Not for you if…", category: "framework", finding: "not-for" },
  { id: "cta", label: "Repeated CTA", category: "framework", finding: "cta-repetition" },
];

// Modeled on Tony Robbins Results Coaching, Clients on Demand, Jay Shetty
// Certification and Consulting.com.
const CALL_BLUEPRINT: BlueprintEntry[] = [
  { id: "hook", label: "Outcome headline", category: "framework", finding: "headline-outcome" },
  { id: "avatar", label: "Who it's for", category: "framework", finding: "who-for" },
  { id: "pain", label: "Pain & problem", category: "framework", finding: "pain" },
  { id: "vision", label: "After-state vision", category: "framework", finding: "vision" },
  { id: "coach", label: "Meet the coach", category: "framework", finding: "coach-story" },
  { id: "how", label: "How it works (steps)", category: "callFunnel", finding: "how-it-works" },
  { id: "proof", label: "Results testimonials", category: "trust", finding: "results-testimonials" },
  { id: "call-named", label: "Named call offer", category: "callFunnel", finding: "call-named" },
  { id: "call-free", label: "Free, with length", category: "callFunnel", finding: "call-free" },
  { id: "takeaway", label: "What you get on the call", category: "callFunnel", finding: "call-takeaway" },
  { id: "no-pressure", label: "No-pressure promise", category: "callFunnel", finding: "no-pressure" },
  { id: "scarcity", label: "Qualification / limited spots", category: "callFunnel", finding: "qualification-scarcity" },
  { id: "faq", label: "FAQ (incl. price)", category: "framework", finding: "faq" },
  { id: "cta", label: "CTAs name the call", category: "callFunnel", finding: "cta-names-call" },
  { id: "booking", label: "1-click booking step", category: "callFunnel", finding: "clicks-to-book" },
  { id: "qualify", label: "Qualifying questions", category: "callFunnel", finding: "qualifying-questions" },
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
function weightsFor(funnel: FunnelType): Record<string, number> {
  return funnel === "call" ? { ...CATEGORY_WEIGHTS, offer: 0.9 } : CATEGORY_WEIGHTS;
}

function buildTopRecommendations(categories: CategoryResult[], weights: Record<string, number>): string[] {
  const weighted = categories.flatMap((c) =>
    c.findings
      .filter((f) => f.status === "fail" || f.status === "warn")
      .map((f) => ({
        ...f,
        category: c.name,
        // A fail matters more than a warn, and a finding in a category that
        // drives coaching sales more than one in a technical category.
        priority: f.weight * (f.status === "fail" ? 2 : 1) * (weights[c.key] ?? 1),
      }))
  );
  return weighted
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10)
    .map((f) => `[${f.category}] ${f.detail}`);
}

export async function analyzeLandingPage(rawUrl: string, mode: FunnelMode = "auto"): Promise<AnalysisReport> {
  const url = normalizeUrl(rawUrl);
  let page;
  try {
    page = await fetchPage(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new AnalysisError(
      `Could not fetch that URL (${message}). Check that it's publicly accessible and try again.`
    );
  }

  if (page.status >= 400) {
    throw new AnalysisError(`The page responded with HTTP ${page.status}.`);
  }
  if (!page.html || page.html.trim().length === 0) {
    throw new AnalysisError("The page returned no HTML content to analyze.");
  }

  const $ = loadHtml(page.html);
  const ctx = buildContext($, page.html, page.finalUrl);

  const [geo, grammar] = await Promise.all([
    analyzeGeo($, page.finalUrl),
    analyzeGrammar($, page.finalUrl),
  ]);
  const detection = detectFunnel(ctx, mode);
  const next = await resolveNextStep(ctx, detection);

  let salesCtx = ctx;
  if (detection.type === "checkout") {
    const merged = mergeWithNextPage(ctx, next);
    if (merged) {
      salesCtx = merged;
      next.steps[next.steps.length - 1]?.notes.push("included in the Offer / Structure / Trust analysis");
    }
  }

  const offer = analyzeOffer(salesCtx, detection.type);
  const framework = analyzeFramework(salesCtx);
  const trust = analyzeTrust(salesCtx);
  const conversion = analyzeConversion(ctx, page.sizeBytes, page.fetchMs);
  const seo = analyzeSeo($, page.finalUrl);
  const clarity = analyzeClarity($);
  const efficiency = analyzeEfficiency($, page.sizeBytes);

  const categories =
    detection.type === "call"
      ? [analyzeCallFunnel(ctx, next), offer, framework, trust, conversion, clarity, seo, geo, efficiency, grammar]
      : [offer, framework, trust, conversion, clarity, seo, geo, efficiency, grammar];
  for (const c of categories) {
    const fallback = DEFAULT_STANDARDS[c.key];
    if (fallback) for (const f of c.findings) f.standard ??= fallback;
  }

  const weights = weightsFor(detection.type);
  const totalWeight = categories.reduce((sum, c) => sum + (weights[c.key] ?? 1), 0);
  const overallScore = Math.round(
    categories.reduce((sum, c) => sum + c.score * (weights[c.key] ?? 1), 0) / totalWeight
  );

  return {
    url,
    finalUrl: page.finalUrl,
    fetchedAt: new Date().toISOString(),
    overallScore,
    overallGrade: gradeFromScore(overallScore),
    categories,
    topRecommendations: buildTopRecommendations(categories, weights),
    blueprint: buildBlueprint(categories, detection.type),
    funnel: funnelInfo(detection, mode, next),
  };
}
