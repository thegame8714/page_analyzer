import { CheerioDoc, getMainContentText } from "./dom";
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
    detail: `Approx. US grade level ${gradeDisplay}. Best-converting landing pages typically write at an 6th-8th grade level.`,
    weight: 2,
  });

  const awps = stats.avgWordsPerSentence;
  findings.push({
    id: "sentence-length",
    label: "Average sentence length",
    status: awps <= 18 ? "pass" : awps <= 24 ? "warn" : "fail",
    detail: `Average of ${awps.toFixed(1)} words per sentence. Keep most sentences under ~18 words for scannability.`,
    weight: 2,
  });

  const complexRatio = stats.complexWordRatio;
  findings.push({
    id: "complex-words",
    label: "Complex word usage",
    status: complexRatio <= 0.12 ? "pass" : complexRatio <= 0.2 ? "warn" : "fail",
    detail: `${(complexRatio * 100).toFixed(0)}% of words have 3+ syllables. Favor short, everyday words over jargon.`,
    weight: 1,
  });

  const passiveRatio = estimatePassiveSentenceRatio(text);
  findings.push({
    id: "passive-voice",
    label: "Passive voice",
    status: passiveRatio <= 0.1 ? "pass" : passiveRatio <= 0.25 ? "warn" : "fail",
    detail: `Roughly ${(passiveRatio * 100).toFixed(0)}% of sentences appear to use passive voice. Active voice ("We ship in 24 hours") converts better than passive ("Orders are shipped within 24 hours").`,
    weight: 2,
  });

  const fillerCount = countFillerWords(text);
  const fillerRatio = fillerCount / Math.max(1, stats.words);
  findings.push({
    id: "filler-words",
    label: "Filler words",
    status: fillerRatio <= 0.01 ? "pass" : fillerRatio <= 0.025 ? "warn" : "fail",
    detail: `${fillerCount} filler word(s) found (e.g. "very", "just", "actually"). Cutting these tightens the copy.`,
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
    summary: "How easy the copy is to read and understand at a glance.",
    findings,
  };
}
