import { loadHtml } from "./dom";
import { fetchPage } from "./fetchPage";
import { analyzeSeo } from "./seo";
import { analyzeGeo } from "./geo";
import { analyzeClarity } from "./clarity";
import { analyzeEfficiency } from "./efficiency";
import { analyzeGrammar } from "./grammar";
import { analyzeConversion } from "./conversion";
import { AnalysisReport, CategoryResult, PageData, gradeFromScore } from "./types";
import { AnalysisError, isLocalUrl, normalizeUrl } from "./normalizeUrl";

export { AnalysisError, normalizeUrl } from "./normalizeUrl";

const CATEGORY_WEIGHTS: Record<string, number> = {
  conversion: 1.3,
  seo: 1,
  geo: 1,
  clarity: 1,
  efficiency: 1,
  grammar: 0.8,
};

function buildTopRecommendations(categories: CategoryResult[]): string[] {
  const failFindings = categories.flatMap((c) =>
    c.findings
      .filter((f) => f.status === "fail")
      .map((f) => ({ ...f, category: c.name, weight: f.weight }))
  );
  const warnFindings = categories.flatMap((c) =>
    c.findings
      .filter((f) => f.status === "warn")
      .map((f) => ({ ...f, category: c.name, weight: f.weight }))
  );
  const sorted = [...failFindings, ...warnFindings].sort((a, b) => b.weight - a.weight);
  const seen = new Set<string>();
  const recs: string[] = [];
  for (const f of sorted) {
    const key = `${f.category}:${f.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    recs.push(`[${f.category}] ${f.detail}`);
    if (recs.length >= 8) break;
  }
  return recs;
}

export async function analyzeLandingPage(rawUrl: string): Promise<AnalysisReport> {
  const url = normalizeUrl(rawUrl);
  let page;
  try {
    page = await fetchPage(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new AnalysisError(
      isLocalUrl(url)
        ? `Could not fetch that URL (${message}). Is your local server running at that address?`
        : `Could not fetch that URL (${message}). Check that it's publicly accessible and try again.`
    );
  }

  if (page.status >= 400) {
    throw new AnalysisError(`The page responded with HTTP ${page.status}.`);
  }
  return analyzePage(page);
}

/**
 * Analyze HTML you already have — e.g. a static page from disk that isn't
 * served anywhere yet. `url` is the page's real or intended address (a
 * file:// URL works); it's only used to resolve relative links and images.
 */
export async function analyzeHtml(html: string, url: string): Promise<AnalysisReport> {
  return analyzePage({
    url,
    finalUrl: url,
    status: 200,
    html,
    fetchMs: 0,
    sizeBytes: Buffer.byteLength(html, "utf8"),
  });
}

async function analyzePage(page: PageData): Promise<AnalysisReport> {
  const url = page.url;
  if (!page.html || page.html.trim().length === 0) {
    throw new AnalysisError("The page returned no HTML content to analyze.");
  }

  const $ = loadHtml(page.html);
  const local = isLocalUrl(page.finalUrl);

  const [geo, grammar] = await Promise.all([
    analyzeGeo($, page.finalUrl),
    analyzeGrammar($, page.finalUrl),
  ]);
  const seo = analyzeSeo($, page.finalUrl);
  const clarity = analyzeClarity($);
  const efficiency = analyzeEfficiency($, page.sizeBytes);
  const conversion = analyzeConversion($, page.sizeBytes, page.fetchMs, local);

  const categories = [conversion, seo, geo, clarity, efficiency, grammar];

  const totalWeight = categories.reduce(
    (sum, c) => sum + (CATEGORY_WEIGHTS[c.key] ?? 1),
    0
  );
  const overallScore = Math.round(
    categories.reduce((sum, c) => sum + c.score * (CATEGORY_WEIGHTS[c.key] ?? 1), 0) /
      totalWeight
  );

  return {
    url,
    finalUrl: page.finalUrl,
    fetchedAt: new Date().toISOString(),
    overallScore,
    overallGrade: gradeFromScore(overallScore),
    categories,
    topRecommendations: buildTopRecommendations(categories),
  };
}
