import { getHeadings, getMainContentText, loadHtml } from "../dom";
import { AnalysisError, analyzePage, loadPage } from "../index";
import { LANGUAGE_NAMES, detectLanguage } from "../language";
import { AnalysisReport, LocalizedText, Product, tr } from "../types";
import { TargetSummary, findCompetitors } from "./agent";

export interface CompetitorResult {
  name: string;
  url: string;
  reason: LocalizedText;
  report?: AnalysisReport;
  /** Set when the competitor's page couldn't be analyzed (blocked, 4xx…). */
  error?: LocalizedText;
}

export interface CompetitorsResponse {
  competitors: CompetitorResult[];
}

export { CompetitorAgentError } from "./agent";

// The agent needs enough copy to understand the offer, not the whole page.
const EXCERPT_WORDS = 1200;

async function summarizeTarget(rawUrl: string, product: Product): Promise<TargetSummary> {
  const { page } = await loadPage(rawUrl);
  const $ = loadHtml(page.html);
  const main = getMainContentText($);
  const language = detectLanguage($, main);
  return {
    url: page.finalUrl,
    product,
    language: LANGUAGE_NAMES[language.code] ?? language.code,
    title: $("title").first().text().trim(),
    metaDescription: $('meta[name="description"]').attr("content")?.trim() ?? "",
    h1: $("h1").first().text().replace(/\s+/g, " ").trim(),
    headings: getHeadings($).map((h) => h.text),
    excerpt: main.split(/\s+/).slice(0, EXCERPT_WORDS).join(" "),
  };
}

/**
 * Finds the analyzed page's top 3 competitors with the research agent, then
 * runs the same analysis on each competitor's page so the scores compare
 * like for like.
 */
export async function analyzeCompetitors(rawUrl: string, product: Product): Promise<CompetitorsResponse> {
  const target = await summarizeTarget(rawUrl, product);
  const candidates = await findCompetitors(target);

  const settled = await Promise.allSettled(
    // Competitors may run a different funnel than the analyzed page, so
    // each one is auto-detected.
    candidates.map((c) => analyzePage(c.url, { product, mode: "auto" }))
  );

  return {
    competitors: candidates.map((c, i) => {
      const result = settled[i];
      if (result.status === "fulfilled") return { ...c, report: result.value };
      const reason = result.reason;
      return {
        ...c,
        error:
          reason instanceof AnalysisError
            ? reason.localized
            : tr("This competitor's page could not be analyzed.", "Non è stato possibile analizzare la pagina di questo concorrente."),
      };
    }),
  };
}
