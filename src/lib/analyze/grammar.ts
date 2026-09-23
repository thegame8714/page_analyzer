import { CheerioDoc, getProseText } from "./dom";
import { DetectedLanguage, detectLanguage } from "./language";
import { splitWords } from "./textUtils";
import { CategoryResult, Finding, FindingItem, gradeFromScore, scoreFromFindings } from "./types";

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
  rule?: { id?: string; issueType?: string; category?: { id?: string; name?: string } };
  context?: { text: string; offset: number; length: number };
  replacements?: { value: string }[];
}

const MAX_CHARS = 9000;

// Non-English coaching copy is full of English business loanwords. The
// public LanguageTool API ignores `altLanguages` for most languages, so they
// get whitelisted here instead of being reported as misspellings.
const ENGLISH_LOANWORDS = new Set(
  ("coach coaching coachee mentor mentoring mindset business call calls live community team webinar workshop online offline " +
    "feedback performance leader leadership network networking focus goal goals target brand branding marketing funnel " +
    "sales lead leads upsell mastermind masterclass bootcamp training trainer tutor tutorial skill skills soft hard " +
    "self care selfcare wellness wellbeing fitness burnout stress planner planning journaling journal checklist template " +
    "templates workbook ebook e-book podcast video newsletter email mail blog post social link bonus free premium " +
    "startup founder ceo manager management personal life executive career job smart working freelance freelancer " +
    "digital content creator creators storytelling copy copywriting landing page sales-page gate fast food step steps " +
    "roadmap framework tool tools kit toolkit hub club academy school program challenge follow-up check-up break " +
    "the of and to meaning purpose flow deep work growth hack hacks happy happiness wow ok okay").split(" ")
);

// Rules that misfire on text stitched together from separate DOM blocks:
// a testimonial's opening quote and closing quote often live in different
// elements, and "…" directly after a word is standard typography.
const IGNORED_RULES = new Set([
  "UNPAIRED_BRACKETS",
  "EN_UNPAIRED_QUOTES",
  "EN_UNPAIRED_BRACKETS",
  "IT_UNPAIRED_BRACKETS",
  "ELLIPSIS",
  "PUNCTUATION_PARAGRAPH_END",
  "WHITESPACE_PUNCTUATION",
]);
const MAX_ITEMS = 25;

function getFlaggedText(m: LanguageToolMatch): string | undefined {
  return m.context && m.context.length > 0
    ? m.context.text.slice(m.context.offset, m.context.offset + m.context.length).trim()
    : undefined;
}

// Business/technical initialisms (EM, EMs, CXO, CEOs, KPI, ROI, SaaS, ...)
// aren't in any dictionary, so a spell-checker reads them as typos. They're
// short, mostly-uppercase tokens (optionally pluralized with a trailing "s")
// — real misspelled words don't look like that, so this is a safe filter.
function isLikelyAcronym(word: string): boolean {
  const stripped = word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");
  if (stripped.length < 2 || stripped.length > 8) return false;
  const core = stripped.replace(/(?:'s|s)$/, "");
  if (core.length < 2) return false;
  const upper = (core.match(/[A-Z]/g) ?? []).length;
  const letters = (core.match(/[A-Za-z]/g) ?? []).length;
  return upper >= 2 && upper / letters >= 0.5;
}

// Coaching pages repeat the coach's name, program name and brand coinages
// ("Forleo", "MarieTV", "Figureoutable") — none are in a dictionary. Treat a
// capitalized or camel-cased token as a proper noun when it recurs on the
// page or appears in the title/domain, instead of reporting it as a typo.
function isLikelyProperNoun(m: LanguageToolMatch, word: string, text: string, brandText: string): boolean {
  const w = word.trim();
  if (!/^\p{Lu}/u.test(w)) return false;
  // Capitalized mid-sentence (not after . ! ? or at the start) → a name.
  if (m.context) {
    const before = m.context.text.slice(0, m.context.offset).trimEnd();
    if (before.length > 0 && !/[.!?:"“”»…]$/.test(before)) return true;
  }
  if (/\p{Ll}\p{Lu}/u.test(w)) return true;
  if (brandText.toLowerCase().includes(w.toLowerCase())) return true;
  const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (text.match(new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "gu")) ?? []).length >= 2;
}

// A "Text Fragment" (#:~:text=...) makes the browser scroll to and highlight
// the exact text on the live page — works on any site, no cooperation needed
// from it. Supported in Chromium browsers (Chrome/Edge); other browsers just
// load the page normally, so this degrades harmlessly where unsupported.
function buildTextFragmentUrl(pageUrl: string, snippet: string): string | undefined {
  const trimmed = snippet.trim();
  // Too short and it's ambiguous (could match unrelated text) or unlikely to
  // be a stable, unique anchor — skip the link rather than send it somewhere wrong.
  if (trimmed.length < 3) return undefined;
  try {
    const u = new URL(pageUrl);
    u.hash = `:~:text=${encodeURIComponent(trimmed)}`;
    return u.toString();
  } catch {
    return undefined;
  }
}

function describeMatch(m: LanguageToolMatch, pageUrl: string): FindingItem {
  const flagged = getFlaggedText(m);
  const suggestions = (m.replacements ?? [])
    .slice(0, 3)
    .map((r) => r.value)
    .filter(Boolean);
  const message = m.shortMessage || m.message;
  const suggestionText = suggestions.length > 0 ? ` (suggested: "${suggestions.join('", "')}")` : "";
  const text = flagged ? `"${flagged}" — ${message}${suggestionText}` : `${message}${suggestionText}`;
  return {
    text,
    href: flagged ? buildTextFragmentUrl(pageUrl, flagged) : undefined,
  };
}

function itemize(matches: LanguageToolMatch[], pageUrl: string): FindingItem[] {
  const items = matches.slice(0, MAX_ITEMS).map((m) => describeMatch(m, pageUrl));
  if (matches.length > MAX_ITEMS) {
    items.push({ text: `…and ${matches.length - MAX_ITEMS} more.` });
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

export async function analyzeGrammar($: CheerioDoc, pageUrl: string): Promise<CategoryResult> {
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

  // Acronyms/initialisms (EMs, CXOs, KPIs, ROI, SaaS...) and recurring
  // proper nouns (coach/program/brand names) aren't spelling mistakes just
  // because they're absent from a dictionary.
  const brandText = `${$("title").text()} ${$('meta[property="og:site_name"]').attr("content") ?? ""} ${pageUrl}`;
  matches = matches.filter((m) => {
    if (m.rule?.id && IGNORED_RULES.has(m.rule.id)) return false;
    const flagged = getFlaggedText(m);
    if (!flagged) return true;
    if (/^[.…]+$/.test(flagged)) return false;
    if (isLikelyAcronym(flagged)) return false;
    if (
      m.rule?.issueType === "misspelling" &&
      language.code !== "en" &&
      flagged.split(/[\s-]+/).every((part) => ENGLISH_LOANWORDS.has(part.toLowerCase()))
    )
      return false;
    if (m.rule?.issueType === "misspelling" && isLikelyProperNoun(m, flagged, text, brandText)) return false;
    return true;
  });

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
    items: spelling.length > 0 ? itemize(spelling, pageUrl) : undefined,
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
    items: grammarIssues.length > 0 ? itemize(grammarIssues, pageUrl) : undefined,
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
      items: itemize(other, pageUrl),
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
