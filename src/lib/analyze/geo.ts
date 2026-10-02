import { CheerioDoc, getHeadings, getJsonLdBlocks, getMainContentText, jsonLdTypes } from "./dom";
import { splitSentences, splitWords } from "./textUtils";
import { CategoryResult, Finding, Product, gradeFromScore, scoreFromFindings, tr } from "./types";

// English + Italian interrogatives — headings in other languages just won't
// be classified as question-style, same as before this was extended.
const QUESTION_WORDS =
  /^(what|why|how|when|where|who|which|can|does|is|are|should|cosa|perch(é|e)|come|quando|dove|chi|quale|quali|posso|devo|dobbiamo|è|sono|serve|conviene)\b/i;

async function checkLlmsTxt(finalUrl: string): Promise<boolean> {
  try {
    const origin = new URL(finalUrl).origin;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${origin}/llms.txt`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export async function analyzeGeo($: CheerioDoc, finalUrl: string, product: Product): Promise<CategoryResult> {
  const coaching = product === "coaching";
  const findings: Finding[] = [];
  const mainText = getMainContentText($);
  const headings = getHeadings($);
  const jsonLd = getJsonLdBlocks($);
  const types = jsonLdTypes(jsonLd).map((t) => t.toLowerCase());

  const words = splitWords(mainText);
  const first200 = words.slice(0, 200).join(" ");
  const first200Sentences = splitSentences(first200);
  const hasAnswerFirstBlock =
    first200Sentences.length >= 2 &&
    first200Sentences.slice(0, 3).some((s) => splitWords(s).length >= 8);
  findings.push({
    id: "answer-first",
    label: tr("Answer-first opening content", "Apertura che risponde subito"),
    status: words.length < 40 ? "fail" : hasAnswerFirstBlock ? "pass" : "warn",
    detail:
      words.length < 40
        ? tr(
            "Almost no extractable text near the top of the page. AI answer engines need substantial text, not just images/JS widgets, to quote from.",
            "Quasi nessun testo estraibile nella parte alta della pagina. I motori di risposta AI hanno bisogno di testo vero, non solo immagini/widget JS, da citare."
          )
        : hasAnswerFirstBlock
        ? tr(
            "The opening content reads as clear, sentence-based statements an AI engine could quote directly.",
            "L'apertura è fatta di frasi chiare e complete che un motore AI potrebbe citare direttamente."
          )
        : tr(
            "The opening content doesn't read as clear standalone sentences. Lead with a 40-60 word block that directly states what you offer and for whom.",
            "L'apertura non è fatta di frasi chiare e autonome. Inizia con un blocco di 40-60 parole che dica direttamente cosa offri e a chi."
          ),
    weight: 3,
  });

  const faqSchema = types.some((t) => t.includes("faqpage"));
  const questionHeadings = headings.filter((h) => QUESTION_WORDS.test(h.text.trim()));
  findings.push({
    id: "faq",
    label: tr("FAQ content & schema", "Contenuti e schema FAQ"),
    status: faqSchema ? "pass" : questionHeadings.length >= 2 ? "warn" : "fail",
    detail: faqSchema
      ? tr(
          "FAQPage structured data found — a strong signal for AI answer engines to extract Q&A pairs.",
          "Trovati dati strutturati FAQPage: un segnale forte per i motori AI che estraggono coppie domanda/risposta."
        )
      : questionHeadings.length >= 2
      ? tr(
          `${questionHeadings.length} question-style headings found, but no FAQPage schema markup to make them machine-readable.`,
          `${questionHeadings.length} titoli in forma di domanda, ma nessuno schema FAQPage che li renda leggibili dalle macchine.`
        )
      : tr(
          "No FAQ section or FAQPage schema found. AI engines favor pages with explicit question/answer pairs.",
          "Nessuna sezione FAQ né schema FAQPage. I motori AI preferiscono le pagine con coppie domanda/risposta esplicite."
        ),
    weight: 2,
  });

  const richSchemaTypes = types.filter((t) =>
    ["course", "educationaloccupationalprogram", "person", "service", "professionalservice", "product", "offer", "event", "organization", "localbusiness", "review", "aggregaterating"].some(
      (k) => t.includes(k)
    )
  );
  findings.push({
    id: "entity-schema",
    label: tr("Entity structured data", "Dati strutturati sull'entità"),
    status: richSchemaTypes.length > 0 ? "pass" : "fail",
    detail:
      richSchemaTypes.length > 0
        ? tr(
            `Structured data declares: ${Array.from(new Set(richSchemaTypes)).join(", ")}. This helps AI systems understand who/what the page is about.`,
            `I dati strutturati dichiarano: ${Array.from(new Set(richSchemaTypes)).join(", ")}. Aiutano i sistemi AI a capire di chi/cosa parla la pagina.`
          )
        : coaching
        ? tr(
            "No Course / Service / Person / Product schema found. Coaching pages should declare the program (Course or Service with an Offer) and the coach (Person) so AI engines can recommend them by name.",
            "Nessuno schema Course / Service / Person / Product. Le pagine di coaching dovrebbero dichiarare il programma (Course o Service con un'Offer) e il coach (Person), così i motori AI possono consigliarli per nome."
          )
        : tr(
            "No Organization/Product/Article/Service schema found. Without it, AI engines have to guess what entity this page represents.",
            "Nessuno schema Organization/Product/Article/Service. Senza, i motori AI devono indovinare quale entità rappresenta la pagina."
          ),
    weight: 2,
  });

  let orgSameAs = 0;
  for (const block of jsonLd) {
    if (block && typeof block === "object") {
      const b = block as Record<string, unknown>;
      const t = String(b["@type"] ?? "").toLowerCase();
      // Coaching brands are usually a person, not a company — count the
      // coach's Person sameAs links too.
      if ((t.includes("organization") || t.includes("person")) && Array.isArray(b["sameAs"])) {
        orgSameAs = Math.max(orgSameAs, (b["sameAs"] as unknown[]).length);
      }
    }
  }
  findings.push({
    id: "entity-clarity",
    label: tr("Entity identity signals (sameAs / social profiles)", "Segnali d'identità dell'entità (sameAs / profili social)"),
    status: orgSameAs >= 2 ? "pass" : orgSameAs === 1 ? "warn" : "fail",
    detail:
      orgSameAs >= 2
        ? tr(
            `Person/Organization schema links to ${orgSameAs} external profiles, helping AI systems disambiguate the brand.`,
            `Lo schema Person/Organization collega ${orgSameAs} profili esterni: aiuta i sistemi AI a identificare il brand senza ambiguità.`
          )
        : coaching
        ? tr(
            "No (or too few) sameAs links in Person/Organization schema tying the coach to verifiable profiles (LinkedIn, Instagram, YouTube, podcast, ICF directory…).",
            "Nessun link sameAs (o troppo pochi) nello schema Person/Organization che colleghi il coach a profili verificabili (LinkedIn, Instagram, YouTube, podcast, elenco ICF…)."
          )
        : tr(
            "No (or too few) sameAs links in Organization schema tying this brand to verifiable external profiles (LinkedIn, Crunchbase, Wikipedia, etc.).",
            "Nessun link sameAs (o troppo pochi) nello schema Organization che colleghi il brand a profili esterni verificabili (LinkedIn, Crunchbase, Wikipedia, ecc.)."
          ),
    weight: 1,
  });

  const dateModified = jsonLd.some(
    (b) => b && typeof b === "object" && ("dateModified" in (b as object) || "datePublished" in (b as object))
  );
  const timeTag = $("time[datetime]").length > 0;
  findings.push({
    id: "freshness",
    label: tr("Content freshness signal", "Segnale di aggiornamento dei contenuti"),
    status: dateModified || timeTag ? "pass" : "warn",
    detail:
      dateModified || timeTag
        ? tr("Page exposes a publish/update date, which AI crawlers use to judge freshness.", "La pagina espone una data di pubblicazione/aggiornamento, che i crawler AI usano per valutarne l'attualità.")
        : tr(
            "No visible publish/update date found. AI engines favor citing recently-updated sources.",
            "Nessuna data di pubblicazione/aggiornamento. I motori AI preferiscono citare fonti aggiornate di recente."
          ),
    weight: 1,
  });

  const listCount = $("ul, ol, table").length;
  findings.push({
    id: "extractable-structure",
    label: tr("Extractable lists & tables", "Elenchi e tabelle estraibili"),
    status: listCount >= 2 ? "pass" : listCount === 1 ? "warn" : "fail",
    detail:
      listCount >= 2
        ? tr(
            `${listCount} list/table elements found — scannable structures that AI systems can quote as bullet answers.`,
            `${listCount} elenchi/tabelle trovati: strutture facili da scorrere che i sistemi AI possono citare come risposte a punti.`
          )
        : tr(
            "Few or no lists/tables found. Breaking key facts (features, pricing, steps) into lists improves AI extractability.",
            "Pochi o nessun elenco/tabella. Suddividere le informazioni chiave (caratteristiche, prezzi, passaggi) in elenchi le rende più estraibili dall'AI."
          ),
    weight: 2,
  });

  const externalLinks = $("a[href^='http']").filter((_, el) => {
    const href = $(el).attr("href") ?? "";
    try {
      return new URL(href).origin !== new URL(finalUrl).origin;
    } catch {
      return false;
    }
  });
  findings.push({
    id: "citations",
    label: tr("External citations / proof links", "Citazioni esterne / link di prova"),
    status: externalLinks.length >= 2 ? "pass" : externalLinks.length === 1 ? "warn" : "fail",
    detail:
      externalLinks.length >= 2
        ? tr(
            `${externalLinks.length} outbound links to external sources, useful as citations/trust signals.`,
            `${externalLinks.length} link verso fonti esterne, utili come citazioni e segnali di fiducia.`
          )
        : tr(
            "Almost no outbound links to authoritative third parties (press, docs, integrations, reviews).",
            "Quasi nessun link verso terze parti autorevoli (stampa, documentazione, integrazioni, recensioni)."
          ),
    weight: 1,
  });

  // A bare file:// page has no site root to look in.
  const checkable = /^https?:/.test(finalUrl);
  const llmsTxt = checkable ? await checkLlmsTxt(finalUrl) : false;
  findings.push({
    id: "llms-txt",
    label: tr("llms.txt file", "File llms.txt"),
    status: llmsTxt ? "pass" : "info",
    detail: !checkable
      ? tr(
          "Not checked for a local file. Add an /llms.txt at the site root when you deploy (optional but a nice-to-have in 2026).",
          "Non controllato per un file locale. Aggiungi un /llms.txt nella root del sito quando lo pubblichi (facoltativo, ma consigliato nel 2026)."
        )
      : llmsTxt
      ? tr(
          "An /llms.txt file was found at the site root, giving AI crawlers a curated map of key content.",
          "Trovato un file /llms.txt nella root del sito: offre ai crawler AI una mappa curata dei contenuti chiave."
        )
      : tr(
          "No /llms.txt found at the site root. This emerging convention helps AI agents find your most important pages (optional but a nice-to-have in 2026).",
          "Nessun /llms.txt nella root del sito. Questa convenzione emergente aiuta gli agenti AI a trovare le tue pagine più importanti (facoltativo, ma consigliato nel 2026)."
        ),
    weight: 1,
  });

  const title = $("title").first().text().trim();
  const h1 = $("h1").first().text().trim();
  const consistentEntity =
    title && h1 && (title.toLowerCase().includes(h1.toLowerCase().slice(0, 10)) || h1.toLowerCase().includes(title.toLowerCase().slice(0, 10)));
  findings.push({
    id: "naming-consistency",
    label: tr("Consistent naming (title vs H1)", "Denominazione coerente (title vs H1)"),
    status: !title || !h1 ? "warn" : consistentEntity ? "pass" : "warn",
    detail:
      !title || !h1
        ? tr("Can't compare title and H1 — one of them is missing.", "Impossibile confrontare title e H1: uno dei due manca.")
        : consistentEntity
        ? tr("Title tag and H1 describe the same thing consistently.", "Il tag title e l'H1 descrivono la stessa cosa in modo coerente.")
        : tr(
            "Title tag and H1 diverge significantly. Keep entity/product naming consistent across title, H1, and schema so AI systems don't get conflicting signals.",
            "Il tag title e l'H1 divergono molto. Mantieni coerente il nome dell'entità/prodotto tra title, H1 e schema, così i sistemi AI non ricevono segnali contrastanti."
          ),
    weight: 1,
  });

  const score = scoreFromFindings(findings);
  return {
    key: "geo",
    name: tr("GEO (AI Search)", "GEO (ricerca AI)"),
    score,
    grade: gradeFromScore(score),
    summary: tr(
      "Generative Engine Optimization: how easily AI answer engines (ChatGPT, Perplexity, AI Overviews, Claude) can understand, extract, and cite this page.",
      "Generative Engine Optimization: quanto facilmente i motori di risposta AI (ChatGPT, Perplexity, AI Overviews, Claude) possono capire, estrarre e citare questa pagina."
    ),
    findings,
  };
}
