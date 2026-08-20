export function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const matches = cleaned.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g);
  return (matches ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function splitWords(text: string): string[] {
  const matches = text.match(/[A-Za-z0-9'’-]+/g);
  return matches ?? [];
}

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
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
  complexWordRatio: number;
  fleschReadingEase: number;
  fleschKincaidGrade: number;
}

export function computeReadability(text: string): ReadabilityStats {
  const sentences = splitSentences(text);
  const words = splitWords(text);
  const wordCount = words.length || 1;
  const sentenceCount = sentences.length || 1;
  let syllableTotal = 0;
  let complexWords = 0;
  for (const w of words) {
    const syl = countSyllables(w);
    syllableTotal += syl;
    if (syl >= 3) complexWords += 1;
  }
  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = syllableTotal / wordCount;
  const fleschReadingEase =
    206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
  const fleschKincaidGrade =
    0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
  return {
    words: words.length,
    sentences: sentences.length,
    syllables: syllableTotal,
    avgWordsPerSentence,
    avgSyllablesPerWord,
    complexWordRatio: complexWords / wordCount,
    fleschReadingEase,
    fleschKincaidGrade,
  };
}

const PASSIVE_AUX = /\b(am|is|are|was|were|be|been|being)\b/i;
const PASSIVE_PARTICIPLE = /\b\w+ed\b|\b(done|made|given|taken|written|known|shown|seen|built|held|found|felt|kept|left|sent|told|sold|paid|put|read|said|led|bought|brought|caught|chosen|driven|drawn|worn|torn|grown|thrown|spoken|broken|frozen|stolen|hidden|ridden)\b/i;

export function estimatePassiveSentenceRatio(text: string): number {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return 0;
  let passiveCount = 0;
  for (const s of sentences) {
    if (PASSIVE_AUX.test(s) && PASSIVE_PARTICIPLE.test(s)) {
      passiveCount += 1;
    }
  }
  return passiveCount / sentences.length;
}

const FILLER_WORDS = [
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
];

export function countFillerWords(text: string): number {
  const lower = text.toLowerCase();
  return FILLER_WORDS.reduce((sum, phrase) => {
    const re = new RegExp(`\\b${phrase.replace(/ /g, "\\s+")}\\b`, "g");
    const matches = lower.match(re);
    return sum + (matches ? matches.length : 0);
  }, 0);
}
