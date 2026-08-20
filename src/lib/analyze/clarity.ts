import { CheerioDoc, getMainContentText } from "./dom";
import { detectLanguage } from "./language";
import {
  computeReadability,
  countFillerWords,
  estimatePassiveSentenceRatio,
} from "./textUtils";
import { CategoryResult, Finding, gradeFromScore, scoreFromFindings } from "./types";

export function analyzeClarity($: CheerioDoc): CategoryResult {
  const findings: Finding[] = [];
  const text = getMainContentText($);
  const stats = computeReadability(text);
  const language = detectLanguage($, text);
  const isItalian = language.code === "it";

  if (stats.words < 30) {
    findings.push({
      id: "not-enough-text",
      label: "Text volume",
      status: "fail",
      detail: "Not enough text on the page to reliably assess clarity (need at least a few sentences).",
      weight: 6,
    });
    const score = scoreFromFindings(findings);
    return {
      key: "clarity",
      name: "Text Clarity",
      score,
      grade: gradeFromScore(score),
      summary: "How easy the copy is to read and understand at a glance.",
      findings,
    };
  }

  // Flesch is calibrated for English syllable patterns and reads as
  // nonsense on other languages (Italian words syllabify very differently).
  // Italian gets the Gulpease index instead — a letter/sentence-length based
  // formula built for Italian, so it doesn't need syllable counting at all.
  if (isItalian) {
    const ease = Math.max(0, Math.min(100, stats.gulpease));
    findings.push({
      id: "reading-ease",
      label: "Gulpease Reading Index",
      status: stats.gulpease >= 60 ? "pass" : stats.gulpease >= 40 ? "warn" : "fail",
      detail: `Score: ${ease.toFixed(0)}/100 (higher = easier; Gulpease is the Italian-calibrated equivalent of Flesch Reading Ease). ${
        stats.gulpease >= 60
          ? "This reads at a plain, conversational level most visitors can skim easily."
          : stats.gulpease >= 40
          ? "This reads at a fairly advanced level — consider shorter sentences and shorter words."
          : "This is hard to read. Landing page copy should be understandable in a quick skim, not a careful study."
      }`,
      weight: 3,
    });

    const band =
      stats.gulpease >= 80
        ? "elementary-school level (~5 years of education) — very accessible"
        : stats.gulpease >= 60
        ? "lower-secondary level (~8 years of education) — accessible to most adults"
        : stats.gulpease >= 40
        ? "upper-secondary level (~13 years of education) — moderately demanding"
        : "university level — hard to skim";
    findings.push({
      id: "grade-level",
      label: "Estimated required education level",
      status: stats.gulpease >= 60 ? "pass" : stats.gulpease >= 40 ? "warn" : "fail",
      detail: `Roughly ${band}. Best-converting landing pages should be readable by a general adult audience.`,
      weight: 2,
    });
  } else {
    const ease = stats.fleschReadingEase;
    const easeDisplay = Math.max(0, Math.min(100, ease));
    findings.push({
      id: "reading-ease",
      label: "Flesch Reading Ease",
      status: ease >= 60 ? "pass" : ease >= 40 ? "warn" : "fail",
      detail: `Score: ${easeDisplay.toFixed(0)}/100 (higher = easier). ${
        ease >= 60
          ? "This reads at a plain, conversational level most visitors can skim easily."
          : ease >= 40
          ? "This reads at a fairly advanced level — consider shorter sentences and simpler words."
          : "This is hard to read. Landing page copy should be understandable in a quick skim, not a careful study."
      }`,
      weight: 3,
    });

    const grade = stats.fleschKincaidGrade;
    const gradeDisplay = grade > 16 ? "16+ (post-graduate)" : grade < 1 ? "<1" : grade.toFixed(1);
    findings.push({
      id: "grade-level",
      label: "Reading grade level",
      status: grade <= 8 ? "pass" : grade <= 11 ? "warn" : "fail",
      detail: `Approx. US grade level ${gradeDisplay}. Best-converting landing pages typically write at an 6th-8th grade level.${
        language.code !== "en"
          ? ` (No dedicated readability formula for ${language.name} yet, so this uses the English-calibrated formula as an approximation.)`
          : ""
      }`,
      weight: 2,
    });
  }

  const awps = stats.avgWordsPerSentence;
  findings.push({
    id: "sentence-length",
    label: "Average sentence length",
    status: awps <= 18 ? "pass" : awps <= 24 ? "warn" : "fail",
    detail: `Average of ${awps.toFixed(1)} words per sentence. Keep most sentences under ~18 words for scannability.`,
    weight: 2,
  });

  // Italian complexity is judged by word length (what Gulpease already keys
  // off of), not syllable count — English's syllable heuristic doesn't apply.
  const complexRatio = isItalian ? stats.longWordRatio : stats.complexWordRatioBySyllables;
  findings.push({
    id: "complex-words",
    label: "Complex word usage",
    status: complexRatio <= 0.12 ? "pass" : complexRatio <= 0.2 ? "warn" : "fail",
    detail: isItalian
      ? `${(complexRatio * 100).toFixed(0)}% of words are long (9+ letters). Favor short, everyday words over jargon.`
      : `${(complexRatio * 100).toFixed(0)}% of words have 3+ syllables. Favor short, everyday words over jargon.`,
    weight: 1,
  });

  const passiveRatio = estimatePassiveSentenceRatio(text);
  findings.push({
    id: "passive-voice",
    label: "Passive voice",
    status: passiveRatio <= 0.1 ? "pass" : passiveRatio <= 0.25 ? "warn" : "fail",
    detail: `Roughly ${(passiveRatio * 100).toFixed(0)}% of sentences appear to use passive voice. Active voice ("We ship in 24 hours" / "Spediamo in 24 ore") converts better than passive ("Orders are shipped..." / "Gli ordini vengono spediti...").`,
    weight: 2,
  });

  const fillerCount = countFillerWords(text);
  const fillerRatio = fillerCount / Math.max(1, stats.words);
  findings.push({
    id: "filler-words",
    label: "Filler words",
    status: fillerRatio <= 0.01 ? "pass" : fillerRatio <= 0.025 ? "warn" : "fail",
    detail: `${fillerCount} filler word(s) found (e.g. "very"/"molto", "just"/"solamente"). Cutting these tightens the copy.`,
    weight: 1,
  });

  const paragraphs = $("p")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 0);
  const longParagraphs = paragraphs.filter((p) => p.split(/\s+/).length > 80);
  findings.push({
    id: "paragraph-length",
    label: "Paragraph scannability",
    status:
      paragraphs.length === 0
        ? "info"
        : longParagraphs.length === 0
        ? "pass"
        : longParagraphs.length <= 2
        ? "warn"
        : "fail",
    detail:
      paragraphs.length === 0
        ? "No <p> paragraphs found to assess."
        : longParagraphs.length === 0
        ? "All paragraphs are short and scannable (under ~80 words)."
        : `${longParagraphs.length} paragraph(s) exceed 80 words. Break long paragraphs into shorter chunks or bullet points.`,
    weight: 2,
  });

  const score = scoreFromFindings(findings);
  return {
    key: "clarity",
    name: "Text Clarity",
    score,
    grade: gradeFromScore(score),
    summary: `How easy the copy is to read and understand at a glance. Detected content language: ${language.name}${
      language.source === "html-lang" ? "" : " (inferred — no <html lang> attribute set)"
    }.`,
    findings,
  };
}
