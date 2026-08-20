import { CheerioDoc, getProseText } from "./dom";
import { splitWords } from "./textUtils";
import { CategoryResult, Finding, gradeFromScore, scoreFromFindings } from "./types";

interface LanguageToolMatch {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  rule?: { issueType?: string; category?: { id?: string; name?: string } };
}

const MAX_CHARS = 9000;

async function callLanguageTool(text: string): Promise<LanguageToolMatch[] | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        text,
        language: "auto",
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
      summary: "Spelling and grammar correctness of the on-page copy.",
      findings,
    };
  }

  let matches = await callLanguageTool(text);
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
    });
  }

  const score = scoreFromFindings(findings);
  return {
    key: "grammar",
    name: "Grammar",
    score,
    grade: gradeFromScore(score),
    summary: "Spelling and grammar correctness of the on-page copy.",
    findings,
  };
}
