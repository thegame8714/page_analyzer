import { CheerioDoc } from "./dom";
import { splitWords } from "./textUtils";

export interface DetectedLanguage {
  code: string;
  name: string;
  source: "html-lang" | "heuristic" | "default";
}

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  it: "Italian",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
};

// Common function words are a reliable, cheap signal for language ID when a
// page doesn't declare <html lang>. Kept short — this only needs to beat a
// low confidence threshold, not be a full classifier.
const STOPWORD_SETS: Record<string, string[]> = {
  en: ["the", "and", "of", "to", "in", "is", "you", "that", "it", "for", "on", "with", "as", "are", "this", "be", "or", "at", "an", "not", "have", "from"],
  it: ["il", "la", "di", "che", "un", "una", "per", "con", "non", "sono", "come", "dove", "anche", "più", "delle", "della", "gli", "del", "alla", "questo", "questa", "dei", "nel", "sul", "è"],
  es: ["el", "la", "de", "que", "un", "una", "por", "con", "no", "son", "como", "donde", "también", "más", "del", "los", "las", "este", "esta", "para", "pero"],
  fr: ["le", "la", "de", "que", "un", "une", "pour", "avec", "ne", "sont", "comme", "où", "aussi", "plus", "des", "les", "ce", "cette", "dans", "mais"],
  de: ["der", "die", "das", "und", "zu", "ist", "du", "dass", "es", "für", "auf", "mit", "als", "sind", "dies", "oder", "bei", "ein", "nicht", "haben"],
  pt: ["o", "a", "de", "que", "um", "uma", "por", "com", "não", "são", "como", "onde", "também", "mais", "dos", "das", "este", "esta", "para", "mas"],
};

/**
 * Detects the page's content language so downstream checks (readability
 * formula, passive-voice grammar, grammar-checker language) can apply the
 * right rules instead of silently assuming English. Prefers the page's own
 * <html lang> declaration; falls back to a stopword-frequency heuristic for
 * pages that omit it, and defaults to English when neither is conclusive
 * (preserving prior behavior for English pages with unusual copy).
 */
export function detectLanguage($: CheerioDoc, sampleText: string): DetectedLanguage {
  const htmlLang = $("html").attr("lang")?.trim().toLowerCase().split("-")[0];
  if (htmlLang && LANGUAGE_NAMES[htmlLang]) {
    return { code: htmlLang, name: LANGUAGE_NAMES[htmlLang], source: "html-lang" };
  }

  const wordSet = new Set(splitWords(sampleText.toLowerCase()).slice(0, 1000));
  let bestCode: string | null = null;
  let bestScore = 0;
  for (const [code, stopwords] of Object.entries(STOPWORD_SETS)) {
    const score = stopwords.reduce((sum, w) => sum + (wordSet.has(w) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestCode = code;
    }
  }
  if (bestCode && bestScore >= 5) {
    return { code: bestCode, name: LANGUAGE_NAMES[bestCode], source: "heuristic" };
  }
  return { code: "en", name: "English", source: "default" };
}
