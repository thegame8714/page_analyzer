export function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const matches = cleaned.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g);
  return (matches ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Unicode-aware: plain [A-Za-z] silently drops every accented letter (à, è,
// ñ, ü, ç, ...), which breaks word counts — and everything derived from them
// — on any non-English page. \p{L}/\p{N} cover letters/digits in any script.
export function splitWords(text: string): string[] {
  const matches = text.match(/[\p{L}\p{N}'’-]+/gu);
  return matches ?? [];
}

// English-only heuristic (vowel-cluster counting), used only for the
// English Flesch formulas below. Not meaningful for other languages' syllable
// structure, so non-English readability uses the letter-based Gulpease index
// instead, which needs no syllable count.
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const stripped = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "");
  const syllableMatches = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, syllableMatches ? syllableMatches.length : 1);
}

export interface ReadabilityStats {
  words: number;
  sentences: number;
  syllables: number;
  letters: number;
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
  avgLettersPerWord: number;
  /** English-oriented complexity proxy: share of words with 3+ syllables. */
  complexWordRatioBySyllables: number;
  /** Language-neutral complexity proxy: share of words over 8 letters. */
  longWordRatio: number;
  /** Flesch Reading Ease — calibrated for English. */
  fleschReadingEase: number;
  /** Flesch-Kincaid Grade Level (US grades) — calibrated for English. */
  fleschKincaidGrade: number;
  /** Gulpease index — Italian readability formula (letters/sentences based,
   * so it doesn't need syllable counting, which English heuristics get wrong
   * for Italian words). 0-100, higher = easier, same direction as Flesch. */
  gulpease: number;
}

export function computeReadability(text: string): ReadabilityStats {
  const sentences = splitSentences(text);
  const words = splitWords(text);
  const wordCount = words.length || 1;
  const sentenceCount = sentences.length || 1;
  let syllableTotal = 0;
  let complexWords = 0;
  let longWords = 0;
  let letterTotal = 0;
  for (const w of words) {
    const syl = countSyllables(w);
    syllableTotal += syl;
    if (syl >= 3) complexWords += 1;
    const letters = (w.match(/\p{L}/gu) ?? []).length;
    letterTotal += letters;
    if (letters > 8) longWords += 1;
  }
  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = syllableTotal / wordCount;
  const avgLettersPerWord = letterTotal / wordCount;
  const fleschReadingEase =
    206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
  const fleschKincaidGrade =
    0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
  // Gulpease = 89 + (300 * sentences - 10 * letters) / words
  const gulpease = 89 + (300 * sentenceCount - 10 * letterTotal) / wordCount;
  return {
    words: words.length,
    sentences: sentences.length,
    syllables: syllableTotal,
    letters: letterTotal,
    avgWordsPerSentence,
    avgSyllablesPerWord,
    avgLettersPerWord,
    complexWordRatioBySyllables: complexWords / wordCount,
    longWordRatio: longWords / wordCount,
    fleschReadingEase,
    fleschKincaidGrade,
    gulpease,
  };
}

// English passive voice: auxiliary "be" + a past participle.
const EN_PASSIVE_AUX = /\b(am|is|are|was|were|be|been|being)\b/i;
const EN_PASSIVE_PARTICIPLE =
  /\b\w+ed\b|\b(done|made|given|taken|written|known|shown|seen|built|held|found|felt|kept|left|sent|told|sold|paid|put|read|said|led|bought|brought|caught|chosen|driven|drawn|worn|torn|grown|thrown|spoken|broken|frozen|stolen|hidden|ridden)\b/i;

// Italian passive voice: "essere"/"venire" conjugations + a past participle
// (regular participles end in -ato/-ito/-uto). Same limitation as the
// English heuristic — participle endings are also common adjective endings —
// so this is approximate, not a parser, matching the English check's quality.
const IT_PASSIVE_AUX =
  /\b(è|sono|era|erano|fu|furono|sarà|saranno|viene|vengono|venne|vennero|verrà|verranno|vengono|venga)\b/i;
const IT_PASSIVE_PARTICIPLE = /\b\w+(ato|ata|ati|ate|uto|uta|uti|ute|ito|ita|iti|ite)\b/i;

export function estimatePassiveSentenceRatio(text: string): number {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return 0;
  let passiveCount = 0;
  for (const s of sentences) {
    const isEnglishPassive = EN_PASSIVE_AUX.test(s) && EN_PASSIVE_PARTICIPLE.test(s);
    const isItalianPassive = IT_PASSIVE_AUX.test(s) && IT_PASSIVE_PARTICIPLE.test(s);
    if (isEnglishPassive || isItalianPassive) passiveCount += 1;
  }
  return passiveCount / sentences.length;
}

const FILLER_WORDS = [
  // English
  "very",
  "really",
  "just",
  "actually",
  "basically",
  "literally",
  "simply",
  "quite",
  "rather",
  "somewhat",
  "in order to",
  "at this point in time",
  "due to the fact that",
  // Italian
  "molto",
  "davvero",
  "solamente",
  "praticamente",
  "letteralmente",
  "semplicemente",
  "abbastanza",
  "piuttosto",
  "fondamentalmente",
  "assolutamente",
  "sostanzialmente",
];

export function countFillerWords(text: string): number {
  const lower = text.toLowerCase();
  return FILLER_WORDS.reduce((sum, phrase) => {
    const re = new RegExp(`\\b${phrase.replace(/ /g, "\\s+")}\\b`, "g");
    const matches = lower.match(re);
    return sum + (matches ? matches.length : 0);
  }, 0);
}
