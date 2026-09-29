import { CheerioDoc, getMainContentText } from "./dom";
import { DetectedLanguage, LANGUAGE_NAMES_IT, detectLanguage } from "./language";
import {
  computeReadability,
  countFillerWords,
  estimatePassiveSentenceRatio,
} from "./textUtils";
import { CategoryResult, Finding, LocalizedText, gradeFromScore, scoreFromFindings, tr } from "./types";

/** "Detected content language: Italian" line shared by Clarity and Grammar. */
export function languageNote(language: DetectedLanguage): LocalizedText {
  const inferred = language.source !== "html-lang";
  return tr(
    `Detected content language: ${language.name}${inferred ? " (inferred — no <html lang> attribute set)" : ""}.`,
    `Lingua rilevata dei contenuti: ${LANGUAGE_NAMES_IT[language.code] ?? language.name}${inferred ? " (dedotta: manca l'attributo <html lang>)" : ""}.`
  );
}

export function analyzeClarity($: CheerioDoc): CategoryResult {
  const findings: Finding[] = [];
  const text = getMainContentText($);
  const stats = computeReadability(text);
  const language = detectLanguage($, text);
  const isItalian = language.code === "it";
  const name = tr("Text Clarity", "Chiarezza del testo");

  if (stats.words < 30) {
    findings.push({
      id: "not-enough-text",
      label: tr("Text volume", "Quantità di testo"),
      status: "fail",
      detail: tr(
        "Not enough text on the page to reliably assess clarity (need at least a few sentences).",
        "Non c'è abbastanza testo per valutare la chiarezza in modo affidabile (servono almeno alcune frasi)."
      ),
      weight: 6,
    });
    const score = scoreFromFindings(findings);
    return {
      key: "clarity",
      name,
      score,
      grade: gradeFromScore(score),
      summary: tr("How easy the copy is to read and understand at a glance.", "Quanto il testo è facile da leggere e capire a colpo d'occhio."),
      findings,
    };
  }

  // Flesch is calibrated for English syllable patterns and reads as
  // nonsense on other languages (Italian words syllabify very differently).
  // Italian gets the Gulpease index instead — a letter/sentence-length based
  // formula built for Italian, so it doesn't need syllable counting at all.
  if (isItalian) {
    const ease = Math.max(0, Math.min(100, stats.gulpease)).toFixed(0);
    findings.push({
      id: "reading-ease",
      label: tr("Gulpease Reading Index", "Indice di leggibilità Gulpease"),
      status: stats.gulpease >= 60 ? "pass" : stats.gulpease >= 40 ? "warn" : "fail",
      detail:
        stats.gulpease >= 60
          ? tr(
              `Score: ${ease}/100 (higher = easier; Gulpease is the Italian-calibrated equivalent of Flesch Reading Ease). This reads at a plain, conversational level most visitors can skim easily.`,
              `Punteggio: ${ease}/100 (più alto = più facile; il Gulpease è l'equivalente del Flesch tarato sull'italiano). Il testo ha un livello semplice e colloquiale, facile da scorrere per la maggior parte dei visitatori.`
            )
          : stats.gulpease >= 40
          ? tr(
              `Score: ${ease}/100 (higher = easier; Gulpease is the Italian-calibrated equivalent of Flesch Reading Ease). This reads at a fairly advanced level — consider shorter sentences and shorter words.`,
              `Punteggio: ${ease}/100 (più alto = più facile; il Gulpease è l'equivalente del Flesch tarato sull'italiano). Il livello è piuttosto avanzato: valuta frasi e parole più brevi.`
            )
          : tr(
              `Score: ${ease}/100 (higher = easier; Gulpease is the Italian-calibrated equivalent of Flesch Reading Ease). This is hard to read. Landing page copy should be understandable in a quick skim, not a careful study.`,
              `Punteggio: ${ease}/100 (più alto = più facile; il Gulpease è l'equivalente del Flesch tarato sull'italiano). Il testo è difficile. Una landing page deve essere comprensibile con una lettura veloce, non con uno studio attento.`
            ),
      weight: 3,
    });

    const band =
      stats.gulpease >= 80
        ? tr("elementary-school level (~5 years of education) — very accessible", "livello scuola primaria (~5 anni di studio): molto accessibile")
        : stats.gulpease >= 60
        ? tr("lower-secondary level (~8 years of education) — accessible to most adults", "livello scuola media (~8 anni di studio): accessibile alla maggior parte degli adulti")
        : stats.gulpease >= 40
        ? tr("upper-secondary level (~13 years of education) — moderately demanding", "livello scuola superiore (~13 anni di studio): moderatamente impegnativo")
        : tr("university level — hard to skim", "livello universitario: difficile da scorrere");
    findings.push({
      id: "grade-level",
      label: tr("Estimated required education level", "Livello di istruzione richiesto (stima)"),
      status: stats.gulpease >= 60 ? "pass" : stats.gulpease >= 40 ? "warn" : "fail",
      detail: tr(
        `Roughly ${band.en}. Best-converting landing pages should be readable by a general adult audience.`,
        `Circa ${band.it}. Le landing page che convertono meglio sono leggibili da un pubblico adulto generico.`
      ),
      weight: 2,
    });
  } else {
    const ease = stats.fleschReadingEase;
    const easeDisplay = Math.max(0, Math.min(100, ease)).toFixed(0);
    findings.push({
      id: "reading-ease",
      label: tr("Flesch Reading Ease", "Indice di leggibilità Flesch"),
      status: ease >= 60 ? "pass" : ease >= 40 ? "warn" : "fail",
      detail:
        ease >= 60
          ? tr(
              `Score: ${easeDisplay}/100 (higher = easier). This reads at a plain, conversational level most visitors can skim easily.`,
              `Punteggio: ${easeDisplay}/100 (più alto = più facile). Il testo ha un livello semplice e colloquiale, facile da scorrere.`
            )
          : ease >= 40
          ? tr(
              `Score: ${easeDisplay}/100 (higher = easier). This reads at a fairly advanced level — consider shorter sentences and simpler words.`,
              `Punteggio: ${easeDisplay}/100 (più alto = più facile). Il livello è piuttosto avanzato: valuta frasi più brevi e parole più semplici.`
            )
          : tr(
              `Score: ${easeDisplay}/100 (higher = easier). This is hard to read. Landing page copy should be understandable in a quick skim, not a careful study.`,
              `Punteggio: ${easeDisplay}/100 (più alto = più facile). Il testo è difficile. Una landing page deve essere comprensibile con una lettura veloce, non con uno studio attento.`
            ),
      weight: 3,
    });

    const grade = stats.fleschKincaidGrade;
    const gradeDisplay = grade > 16 ? tr("16+ (post-graduate)", "16+ (post-laurea)") : grade < 1 ? tr("<1", "<1") : tr(grade.toFixed(1), grade.toFixed(1));
    const approx = language.code !== "en";
    findings.push({
      id: "grade-level",
      label: tr("Reading grade level", "Livello scolastico di lettura"),
      status: grade <= 8 ? "pass" : grade <= 11 ? "warn" : "fail",
      detail: tr(
        `Approx. US grade level ${gradeDisplay.en}. Best-converting landing pages typically write at an 6th-8th grade level.${
          approx ? ` (No dedicated readability formula for ${language.name} yet, so this uses the English-calibrated formula as an approximation.)` : ""
        }`,
        `Livello scolastico USA approssimativo: ${gradeDisplay.it}. Le landing page che convertono meglio scrivono di solito a un livello di 6ª-8ª classe (scuola media).${
          approx ? ` (Non c'è ancora una formula dedicata al ${LANGUAGE_NAMES_IT[language.code] ?? language.name}, quindi si usa quella inglese come approssimazione.)` : ""
        }`
      ),
      weight: 2,
    });
  }

  const awps = stats.avgWordsPerSentence.toFixed(1);
  findings.push({
    id: "sentence-length",
    label: tr("Average sentence length", "Lunghezza media delle frasi"),
    status: stats.avgWordsPerSentence <= 18 ? "pass" : stats.avgWordsPerSentence <= 24 ? "warn" : "fail",
    detail: tr(
      `Average of ${awps} words per sentence. Keep most sentences under ~18 words for scannability.`,
      `In media ${awps} parole per frase. Tieni la maggior parte delle frasi sotto le ~18 parole per renderle facili da scorrere.`
    ),
    weight: 2,
  });

  // Italian complexity is judged by word length (what Gulpease already keys
  // off of), not syllable count — English's syllable heuristic doesn't apply.
  const complexRatio = isItalian ? stats.longWordRatio : stats.complexWordRatioBySyllables;
  const complexPct = (complexRatio * 100).toFixed(0);
  findings.push({
    id: "complex-words",
    label: tr("Complex word usage", "Uso di parole complesse"),
    status: complexRatio <= 0.12 ? "pass" : complexRatio <= 0.2 ? "warn" : "fail",
    detail: isItalian
      ? tr(
          `${complexPct}% of words are long (9+ letters). Favor short, everyday words over jargon.`,
          `Il ${complexPct}% delle parole è lungo (9+ lettere). Preferisci parole brevi e quotidiane al gergo tecnico.`
        )
      : tr(
          `${complexPct}% of words have 3+ syllables. Favor short, everyday words over jargon.`,
          `Il ${complexPct}% delle parole ha 3+ sillabe. Preferisci parole brevi e quotidiane al gergo tecnico.`
        ),
    weight: 1,
  });

  const passiveRatio = estimatePassiveSentenceRatio(text);
  const passivePct = (passiveRatio * 100).toFixed(0);
  findings.push({
    id: "passive-voice",
    label: tr("Passive voice", "Forma passiva"),
    status: passiveRatio <= 0.1 ? "pass" : passiveRatio <= 0.25 ? "warn" : "fail",
    detail: tr(
      `Roughly ${passivePct}% of sentences appear to use passive voice. Active voice ("We ship in 24 hours" / "Spediamo in 24 ore") converts better than passive ("Orders are shipped..." / "Gli ordini vengono spediti...").`,
      `Circa il ${passivePct}% delle frasi sembra usare la forma passiva. La forma attiva ("Spediamo in 24 ore") converte meglio di quella passiva ("Gli ordini vengono spediti...").`
    ),
    weight: 2,
  });

  const fillerCount = countFillerWords(text);
  const fillerRatio = fillerCount / Math.max(1, stats.words);
  findings.push({
    id: "filler-words",
    label: tr("Filler words", "Parole riempitive"),
    status: fillerRatio <= 0.01 ? "pass" : fillerRatio <= 0.025 ? "warn" : "fail",
    detail: tr(
      `${fillerCount} filler word(s) found (e.g. "very"/"molto", "just"/"solamente"). Cutting these tightens the copy.`,
      `${fillerCount} parole riempitive trovate (es. "molto", "davvero", "solamente"). Eliminarle rende il testo più incisivo.`
    ),
    weight: 1,
  });

  const paragraphs = $("p")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 0);
  const longParagraphs = paragraphs.filter((p) => p.split(/\s+/).length > 80);
  findings.push({
    id: "paragraph-length",
    label: tr("Paragraph scannability", "Paragrafi facili da scorrere"),
    status: paragraphs.length === 0 ? "info" : longParagraphs.length === 0 ? "pass" : longParagraphs.length <= 2 ? "warn" : "fail",
    detail:
      paragraphs.length === 0
        ? tr("No <p> paragraphs found to assess.", "Nessun paragrafo <p> da valutare.")
        : longParagraphs.length === 0
        ? tr("All paragraphs are short and scannable (under ~80 words).", "Tutti i paragrafi sono brevi e facili da scorrere (meno di ~80 parole).")
        : tr(
            `${longParagraphs.length} paragraph(s) exceed 80 words. Break long paragraphs into shorter chunks or bullet points.`,
            `${longParagraphs.length} paragrafi superano le 80 parole. Spezza i paragrafi lunghi in blocchi più brevi o elenchi puntati.`
          ),
    weight: 2,
  });

  const score = scoreFromFindings(findings);
  const note = languageNote(language);
  return {
    key: "clarity",
    name,
    score,
    grade: gradeFromScore(score),
    summary: tr(
      `How easy the copy is to read and understand at a glance. ${note.en}`,
      `Quanto il testo è facile da leggere e capire a colpo d'occhio. ${note.it}`
    ),
    findings,
  };
}
