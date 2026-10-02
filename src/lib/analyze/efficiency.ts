import { CheerioDoc, getMainContentText, getVisibleText } from "./dom";
import { splitWords } from "./textUtils";
import { countLeadCaptureFields, ctaLabel, findCtaElements } from "./cta";
import { CategoryResult, Finding, gradeFromScore, scoreFromFindings, tr } from "./types";

const STOPWORDS = new Set(
  ("a about above after again against all am an and any are aren't as at be because been before being below between both but by can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves your our" +
    // Italian, so keyword-repetition doesn't just surface a function word on
    // non-English pages.
    " il lo la i gli le di che un uno una per con non sono come dove anche più delle della dei del alla allo alle agli questo questa questi queste quello quella quelli quelle nel nello nella negli nelle sul sullo sulla sugli sulle dal dallo dalla dagli dalle ma però quindi perché anche se tra fra si ci ne loro suo sua suoi sue nostro nostra nostri nostre vostro vostra vostri vostre essere avere fare"
  ).split(" ")
);

export function analyzeEfficiency($: CheerioDoc, htmlSizeBytes: number): CategoryResult {
  const findings: Finding[] = [];
  const visibleText = getVisibleText($);
  const mainText = getMainContentText($);
  const words = splitWords(mainText);

  const textBytes = Buffer.byteLength(visibleText, "utf8");
  const codeRatio = htmlSizeBytes > 0 ? textBytes / htmlSizeBytes : 0;
  findings.push({
    id: "content-to-code",
    label: tr("Content-to-code ratio", "Rapporto contenuto/codice"),
    status: codeRatio >= 0.1 ? "pass" : codeRatio >= 0.04 ? "warn" : "fail",
    detail: tr(
      `Visible text is ${(codeRatio * 100).toFixed(1)}% of total page bytes (${textBytes} of ${htmlSizeBytes}). A low ratio often means bloated markup/scripts diluting the actual message.`,
      `Il testo visibile è il ${(codeRatio * 100).toFixed(1)}% dei byte della pagina (${textBytes} su ${htmlSizeBytes}). Un rapporto basso spesso indica markup/script appesantiti che diluiscono il messaggio.`
    ),
    weight: 2,
  });

  const wordCount = words.length;
  findings.push({
    id: "word-count",
    label: tr("Content depth", "Profondità dei contenuti"),
    status: wordCount < 100 ? "fail" : wordCount < 200 ? "warn" : "pass",
    detail:
      wordCount < 100
        ? tr(
            `Only ~${wordCount} words of main content. There's likely not enough substance to explain the offer and overcome objections.`,
            `Solo ~${wordCount} parole di contenuto principale. Probabilmente non basta per spiegare l'offerta e superare le obiezioni.`
          )
        : tr(`~${wordCount} words of main content — enough room to explain the offer.`, `~${wordCount} parole di contenuto principale: spazio sufficiente per spiegare l'offerta.`),
    weight: 2,
  });

  const ctaElements = findCtaElements($);
  // Presence counts anything button-like; "competing asks" only counts real
  // conversion actions, so "Sign in" / "Add to calendar" don't inflate it.
  const ctaTexts = new Set(
    findCtaElements($, true)
      .map((_, el) => ctaLabel($(el)).toLowerCase())
      .get()
  );
  findings.push({
    id: "cta-presence",
    label: tr("Call-to-action presence", "Presenza di call to action"),
    status: ctaElements.length === 0 ? "fail" : "pass",
    detail:
      ctaElements.length === 0
        ? tr(
            "No clear call-to-action buttons/links detected (e.g. 'Get started', 'Sign up', 'Buy now').",
            "Nessun pulsante/link di call to action chiaro (es. \"Inizia ora\", \"Iscriviti\", \"Acquista\")."
          )
        : tr(`${ctaElements.length} CTA element(s) found on the page.`, `${ctaElements.length} elementi di CTA nella pagina.`),
    weight: 3,
  });

  findings.push({
    id: "cta-focus",
    label: tr("Single-goal focus", "Un solo obiettivo"),
    status: ctaTexts.size === 0 ? "info" : ctaTexts.size <= 2 ? "pass" : ctaTexts.size <= 4 ? "warn" : "fail",
    detail:
      ctaTexts.size === 0
        ? tr("No CTA text variety to assess.", "Nessuna varietà di CTA da valutare.")
        : ctaTexts.size <= 2
        ? tr(
            `The page centers on ${ctaTexts.size} distinct CTA message(s), keeping the ask focused.`,
            `La pagina si concentra su ${ctaTexts.size} messaggi di CTA distinti: la richiesta resta focalizzata.`
          )
        : tr(
            `${ctaTexts.size} different CTA messages found (${Array.from(ctaTexts).slice(0, 5).join(", ")}...). Too many competing asks dilute conversion — a landing page should drive one primary action.`,
            `${ctaTexts.size} messaggi di CTA diversi (${Array.from(ctaTexts).slice(0, 5).join(", ")}...). Troppe richieste in competizione diluiscono la conversione: una landing page dovrebbe spingere un'unica azione principale.`
          ),
    weight: 2,
  });

  const navLinks = $("nav a, header a").length;
  findings.push({
    id: "nav-distraction",
    label: tr("Navigation distraction", "Distrazioni dalla navigazione"),
    status: navLinks === 0 ? "pass" : navLinks <= 5 ? "pass" : navLinks <= 10 ? "warn" : "fail",
    detail:
      navLinks === 0
        ? tr(
            "No exit-heavy navigation detected — good, this keeps visitors focused on converting.",
            "Nessuna navigazione piena di vie d'uscita: bene, i visitatori restano concentrati sulla conversione."
          )
        : navLinks <= 5
        ? tr(`${navLinks} nav/header link(s) — a reasonably lean navigation.`, `${navLinks} link nel menu/header: una navigazione abbastanza snella.`)
        : tr(
            `${navLinks} nav/header links found. Dedicated landing pages convert better with minimal navigation, since every extra link is a way to leave without converting.`,
            `${navLinks} link nel menu/header. Le landing page dedicate convertono meglio con una navigazione minima: ogni link in più è un modo per uscire senza convertire.`
          ),
    weight: 2,
  });

  const wordFreq = new Map<string, number>();
  for (const w of words) {
    const lw = w.toLowerCase();
    if (lw.length < 4 || STOPWORDS.has(lw)) continue;
    wordFreq.set(lw, (wordFreq.get(lw) ?? 0) + 1);
  }
  let topWord = "";
  let topCount = 0;
  for (const [w, c] of wordFreq) {
    if (c > topCount) {
      topWord = w;
      topCount = c;
    }
  }
  const density = wordCount > 0 ? topCount / wordCount : 0;
  findings.push({
    id: "keyword-stuffing",
    label: tr("Keyword repetition", "Ripetizione di parole chiave"),
    status: density <= 0.035 ? "pass" : density <= 0.06 ? "warn" : "fail",
    detail:
      topWord
        ? tr(
            `Most-repeated word "${topWord}" appears ${topCount} times (${(density * 100).toFixed(1)}% of words). Above ~4-5% density starts to feel repetitive/stuffed.`,
            `La parola più ripetuta, "${topWord}", compare ${topCount} volte (${(density * 100).toFixed(1)}% delle parole). Oltre il ~4-5% il testo inizia a sembrare ripetitivo/forzato.`
          )
        : tr("Not enough content to assess keyword repetition.", "Contenuto insufficiente per valutare la ripetizione di parole chiave."),
    weight: 1,
  });

  const forms = $("form");
  let maxFormFields = 0;
  if (forms.length > 0) {
    forms.each((_, el) => {
      const fields = countLeadCaptureFields($, $(el));
      if (fields > maxFormFields) maxFormFields = fields;
    });
  } else {
    // Some page builders render lead-capture inputs without a <form> wrapper.
    maxFormFields = countLeadCaptureFields($, $.root());
  }
  if (forms.length > 0 || maxFormFields > 0) {
    findings.push({
      id: "form-length",
      label: tr("Form length", "Lunghezza del form"),
      status: maxFormFields === 0 ? "info" : maxFormFields <= 4 ? "pass" : maxFormFields <= 7 ? "warn" : "fail",
      detail:
        maxFormFields === 0
          ? tr("Form detected but no visible input fields found.", "Form rilevato, ma senza campi visibili.")
          : maxFormFields <= 4
          ? tr(
              `Largest form has ${maxFormFields} field(s) — short forms convert significantly better.`,
              `Il form più lungo ha ${maxFormFields} campi: i form brevi convertono molto meglio.`
            )
          : tr(
              `Largest form has ${maxFormFields} fields. Cutting non-essential fields is one of the highest-leverage conversion fixes.`,
              `Il form più lungo ha ${maxFormFields} campi. Eliminare i campi non essenziali è uno degli interventi più efficaci sulla conversione.`
            ),
      weight: 2,
    });
  }

  const score = scoreFromFindings(findings);
  return {
    key: "efficiency",
    name: tr("Content Efficiency", "Efficienza dei contenuti"),
    score,
    grade: gradeFromScore(score),
    summary: tr(
      "Whether every element on the page earns its place in driving the visitor toward one clear action.",
      "Se ogni elemento della pagina si guadagna il suo posto nel portare il visitatore verso un'unica azione chiara."
    ),
    findings,
  };
}
