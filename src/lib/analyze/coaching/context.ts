import { CheerioDoc, getHeadings, getMainContentText, getVisibleText } from "../dom";
import { CTA_PATTERN } from "../cta";
import { DetectedLanguage, detectLanguage } from "../language";
import { splitWords } from "../textUtils";
import { CategoryResult, Finding, FindingItem, gradeFromScore, scoreFromFindings, Text } from "../types";
import { COACHING_CTA } from "./patterns";

/** Everything the coaching checks need, extracted from the DOM once. */
export interface CoachingContext {
  $: CheerioDoc;
  html: string;
  finalUrl: string;
  bodyText: string;
  mainText: string;
  /** H1 + the opening ~120 words — roughly what's visible above the fold. */
  heroText: string;
  h1: string;
  headings: { level: number; text: string }[];
  headingText: string;
  ctaTexts: string[];
  wordCount: number;
  language: DetectedLanguage;
}

export function isCta(text: string): boolean {
  return text.length > 0 && text.length < 60 && (CTA_PATTERN.test(text) || COACHING_CTA.test(text));
}

// Pages use typographic apostrophes/quotes ("I’m", "you’ll"); the patterns
// are written with straight ones, so normalize before matching.
function normalizeQuotes(text: string): string {
  return text.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"');
}

export function buildContext($: CheerioDoc, html: string, finalUrl: string): CoachingContext {
  const bodyText = normalizeQuotes(getVisibleText($));
  const mainText = normalizeQuotes(getMainContentText($));
  const headings = getHeadings($).map((h) => ({ ...h, text: normalizeQuotes(h.text) }));
  const h1 = normalizeQuotes($("h1").first().text().replace(/\s+/g, " ").trim());
  const words = splitWords(mainText);
  // Page builders often put the subheadline in a <p> or <h2> right after the
  // H1, so the first ~120 words of main content approximates the hero area.
  const heroText = `${h1} ${words.slice(0, 120).join(" ")}`.trim();
  const ctaTexts = $("a, button, input[type=submit]")
    .map((_, el) => normalizeQuotes(($(el).is("input") ? $(el).attr("value") ?? "" : $(el).text()).replace(/\s+/g, " ").trim()))
    .get()
    .filter(isCta);

  return {
    $,
    html,
    finalUrl,
    bodyText,
    mainText,
    heroText,
    h1,
    headings,
    headingText: headings.map((h) => h.text).join(" · "),
    ctaTexts,
    wordCount: words.length,
    language: detectLanguage($, mainText),
  };
}

export function textFragmentUrl(pageUrl: string, snippet: string): string | undefined {
  const trimmed = snippet.trim();
  if (trimmed.length < 3) return undefined;
  try {
    const u = new URL(pageUrl);
    u.hash = `:~:text=${encodeURIComponent(trimmed)}`;
    return u.toString();
  } catch {
    return undefined;
  }
}

/** Itemize matched phrases as deep links that highlight them on the live page. */
export function matchItems(pageUrl: string, matches: string[], max = 12): FindingItem[] {
  return matches.slice(0, max).map((m) => ({ text: `"${m}"`, href: textFragmentUrl(pageUrl, m) }));
}

export function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(new RegExp(re.source, re.flags.replace("g", "")));
  return m ? m[0] : null;
}

export function category(key: string, name: Text, summary: Text, findings: Finding[]): CategoryResult {
  const score = scoreFromFindings(findings);
  return { key, name, score, grade: gradeFromScore(score), summary, findings };
}
