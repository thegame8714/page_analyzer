import { CheerioDoc, getProseText } from "./dom";
import { DetectedLanguage, detectLanguage } from "./language";
import { splitWords } from "./textUtils";
import { CategoryResult, Finding, gradeFromScore, scoreFromFindings } from "./types";

// LanguageTool needs a region variant for some languages; bare codes 404/400.
// Only used when we're reasonably confident (html-lang or stopword match) —
// otherwise we pass "auto" and let LanguageTool detect it itself.
const LANGUAGE_TOOL_CODES: Record<string, string> = {
  en: "en-US",
  it: "it",
  es: "es",
  fr: "fr",
  de: "de-DE",
  pt: "pt-PT",
};

interface LanguageToolMatch {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  rule?: { issueType?: string; category?: { id?: string; name?: string } };
  context?: { text: string; offset: number; length: number };
  replacements?: { value: string }[];
}

const MAX_CHARS = 9000;
const MAX_ITEMS = 25;

function describeMatch(m: LanguageToolMatch): string {
  const flagged =
    m.context && m.context.length > 0
      ? m.context.text.slice(m.context.offset, m.context.offset + m.context.length).trim()
      : undefined;
  const suggestions = (m.replacements ?? [])
    .slice(0, 3)
    .map((r) => r.value)
    .filter(Boolean);
  const message = m.shortMessage || m.message;
  const suggestionText = suggestions.length > 0 ? ` (suggested: "${suggestions.join('", "')}")` : "";
  return flagged ? `"${flagged}" — ${message}${suggestionText}` : `${message}${suggestionText}`;
}

function itemize(matches: LanguageToolMatch[]): string[] {
  const items = matches.slice(0, MAX_ITEMS).map(describeMatch);
  if (matches.length > MAX_ITEMS) {
    items.push(`…and ${matches.length - MAX_ITEMS} more.`);
  }
  return items;
}

async function callLanguageTool(
  text: string,
  languageToolCode: string
): Promise<LanguageToolMatch[] | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        text,
        language: languageToolCode,
        enabledOnly: "false",
      }),
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { matches?: LanguageToolMatch[] };
    return data.matches ?? [];
  } catch {
    return null;
  }
}

function heuristicIssues(text: string): LanguageToolMatch[] {
  const issues: LanguageToolMatch[] = [];
  const doubleSpace = text.match(/ {2,}/g);
  if (doubleSpace) {
    issues.push({
      message: `Found ${doubleSpace.length} instance(s) of double spacing.`,
      offset: 0,
      length: 0,
      rule: { issueType: "typographical" },
    });
  }
  const repeated = text.match(/\b(\w+)\s+\1\b/gi);
  if (repeated) {
    issues.push({
      message: `Found ${repeated.length} repeated word(s) (e.g. "${repeated[0]}").`,
      offset: 0,
      length: 0,
      rule: { issueType: "duplication" },
    });
  }
  return issues;
}

export async function analyzeGrammar($: CheerioDoc): Promise<CategoryResult> {
  const findings: Finding[] = [];
  const text = getProseText($).slice(0, MAX_CHARS);
  const wordCount = splitWords(text).length;
  const language: DetectedLanguage = detectLanguage($, text);
  const summary = `Spelling and grammar correctness of the on-page copy. Detected content language: ${language.name}${
    language.source === "html-lang" ? "" : " (inferred — no <html lang> attribute set)"
  }.`;

  if (wordCount < 20) {
    findings.push({
      id: "not-enough-text",
      label: "Text volume",
      status: "info",
      detail: "Not enough text on the page to run a grammar check.",
      weight: 1,
    });
    const score = scoreFromFindings(findings);
    return {
      key: "grammar",
      name: "Grammar",
      score,
      grade: gradeFromScore(score),
      summary,
      findings,
    };
  }

  // Only force a specific language when we're reasonably confident; otherwise
  // let LanguageTool auto-detect (it handles this better than guessing).
  const languageToolCode =
    language.source === "default" ? "auto" : LANGUAGE_TOOL_CODES[language.code] ?? "auto";
  let matches = await callLanguageTool(text, languageToolCode);
  let usedFallback = false;
  if (matches === null) {
    matches = heuristicIssues(text);
    usedFallback = true;
  }

  // Regional spelling variants (British vs. American) aren't actual errors —
  // don't penalize a page for spelling consistently in one English dialect.
  matches = matches.filter(
    (m) => !/British English|American English/i.test(m.message)
  );

  const spelling = matches.filter((m) => m.rule?.issueType === "misspelling");
  const grammarIssues = matches.filter(
    (m) => m.rule?.issueType && m.rule.issueType !== "misspelling"
  );
  const other = matches.filter((m) => !m.rule?.issueType);

  const totalIssues = matches.length;
  const issuesPer100Words = (totalIssues / Math.max(1, wordCount)) * 100;

  findings.push({
    id: "spelling",
    label: "Spelling",
    status: spelling.length === 0 ? "pass" : spelling.length <= 2 ? "warn" : "fail",
    detail:
      spelling.length === 0
        ? "No spelling errors detected."
        : `${spelling.length} likely spelling error(s) found${
            spelling[0] ? `, e.g. "${spelling[0].message}"` : ""
          }.`,
    weight: 3,
    items: spelling.length > 0 ? itemize(spelling) : undefined,
  });

  findings.push({
    id: "grammar-style",
    label: "Grammar & style",
    status: grammarIssues.length === 0 ? "pass" : grammarIssues.length <= 3 ? "warn" : "fail",
    detail:
      grammarIssues.length === 0
        ? "No grammar or style issues detected."
        : `${grammarIssues.length} grammar/style issue(s) found${
            grammarIssues[0] ? `, e.g. "${grammarIssues[0].message}"` : ""
          }.`,
    weight: 3,
    items: grammarIssues.length > 0 ? itemize(grammarIssues) : undefined,
  });

  findings.push({
    id: "error-density",
    label: "Overall error density",
    status: issuesPer100Words < 1 ? "pass" : issuesPer100Words < 3 ? "warn" : "fail",
    detail: `${totalIssues} total issue(s) across ~${wordCount} words (${issuesPer100Words.toFixed(
      1
    )} per 100 words).${usedFallback ? " (Basic offline check used — live grammar API was unreachable.)" : ""}`,
    weight: 2,
  });

  if (other.length > 0) {
    findings.push({
      id: "misc-issues",
      label: "Other issues",
      status: other.length <= 2 ? "warn" : "fail",
      detail: `${other.length} other issue(s), e.g. "${other[0].message}".`,
      weight: 1,
      items: itemize(other),
    });
  }

  const score = scoreFromFindings(findings);
  return {
    key: "grammar",
    name: "Grammar",
    score,
    grade: gradeFromScore(score),
    summary,
    findings,
  };
}
