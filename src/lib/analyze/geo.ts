import { CheerioDoc, getHeadings, getJsonLdBlocks, getMainContentText, jsonLdTypes } from "./dom";
import { splitSentences, splitWords } from "./textUtils";
import { CategoryResult, Finding, gradeFromScore, scoreFromFindings } from "./types";

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

export async function analyzeGeo($: CheerioDoc, finalUrl: string): Promise<CategoryResult> {
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
    label: "Answer-first opening content",
    status: words.length < 40 ? "fail" : hasAnswerFirstBlock ? "pass" : "warn",
    detail:
      words.length < 40
        ? "Almost no extractable text near the top of the page. AI answer engines need substantial text, not just images/JS widgets, to quote from."
        : hasAnswerFirstBlock
        ? "The opening content reads as clear, sentence-based statements an AI engine could quote directly."
        : "The opening content doesn't read as clear standalone sentences. Lead with a 40-60 word block that directly states what you offer and for whom.",
    weight: 3,
  });

  const faqSchema = types.some((t) => t.includes("faqpage"));
  const questionHeadings = headings.filter((h) => QUESTION_WORDS.test(h.text.trim()));
  findings.push({
    id: "faq",
    label: "FAQ content & schema",
    status: faqSchema ? "pass" : questionHeadings.length >= 2 ? "warn" : "fail",
    detail: faqSchema
      ? "FAQPage structured data found — a strong signal for AI answer engines to extract Q&A pairs."
      : questionHeadings.length >= 2
      ? `${questionHeadings.length} question-style headings found, but no FAQPage schema markup to make them machine-readable.`
      : "No FAQ section or FAQPage schema found. AI engines favor pages with explicit question/answer pairs.",
    weight: 2,
  });

  const richSchemaTypes = types.filter((t) =>
    ["course", "educationaloccupationalprogram", "person", "service", "professionalservice", "product", "offer", "event", "organization", "localbusiness", "review", "aggregaterating"].some(
      (k) => t.includes(k)
    )
  );
  findings.push({
    id: "entity-schema",
    label: "Entity structured data",
    status: richSchemaTypes.length > 0 ? "pass" : "fail",
    detail:
      richSchemaTypes.length > 0
        ? `Structured data declares: ${Array.from(new Set(richSchemaTypes)).join(", ")}. This helps AI systems understand who/what the page is about.`
        : "No Course / Service / Person / Product schema found. Coaching pages should declare the program (Course or Service with an Offer) and the coach (Person) so AI engines can recommend them by name.",
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
    label: "Entity identity signals (sameAs / social profiles)",
    status: orgSameAs >= 2 ? "pass" : orgSameAs === 1 ? "warn" : "fail",
    detail:
      orgSameAs >= 2
        ? `Person/Organization schema links to ${orgSameAs} external profiles, helping AI systems disambiguate the coach's brand.`
        : "No (or too few) sameAs links in Person/Organization schema tying the coach to verifiable profiles (LinkedIn, Instagram, YouTube, podcast, ICF directory…).",
    weight: 1,
  });

  const dateModified = jsonLd.some(
    (b) => b && typeof b === "object" && ("dateModified" in (b as object) || "datePublished" in (b as object))
  );
  const timeTag = $("time[datetime]").length > 0;
  findings.push({
    id: "freshness",
    label: "Content freshness signal",
    status: dateModified || timeTag ? "pass" : "warn",
    detail:
      dateModified || timeTag
        ? "Page exposes a publish/update date, which AI crawlers use to judge freshness."
        : "No visible publish/update date found. AI engines favor citing recently-updated sources.",
    weight: 1,
  });

  const listCount = $("ul, ol, table").length;
  findings.push({
    id: "extractable-structure",
    label: "Extractable lists & tables",
    status: listCount >= 2 ? "pass" : listCount === 1 ? "warn" : "fail",
    detail:
      listCount >= 2
        ? `${listCount} list/table elements found — scannable structures that AI systems can quote as bullet answers.`
        : "Few or no lists/tables found. Breaking key facts (features, pricing, steps) into lists improves AI extractability.",
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
    label: "External citations / proof links",
    status: externalLinks.length >= 2 ? "pass" : externalLinks.length === 1 ? "warn" : "fail",
    detail:
      externalLinks.length >= 2
        ? `${externalLinks.length} outbound links to external sources, useful as citations/trust signals.`
        : "Almost no outbound links to authoritative third parties (press, docs, integrations, reviews).",
    weight: 1,
  });

  const llmsTxt = await checkLlmsTxt(finalUrl);
  findings.push({
    id: "llms-txt",
    label: "llms.txt file",
    status: llmsTxt ? "pass" : "info",
    detail: llmsTxt
      ? "An /llms.txt file was found at the site root, giving AI crawlers a curated map of key content."
      : "No /llms.txt found at the site root. This emerging convention helps AI agents find your most important pages (optional but a nice-to-have in 2026).",
    weight: 1,
  });

  const title = $("title").first().text().trim();
  const h1 = $("h1").first().text().trim();
  const consistentEntity =
    title && h1 && (title.toLowerCase().includes(h1.toLowerCase().slice(0, 10)) || h1.toLowerCase().includes(title.toLowerCase().slice(0, 10)));
  findings.push({
    id: "naming-consistency",
    label: "Consistent naming (title vs H1)",
    status: !title || !h1 ? "warn" : consistentEntity ? "pass" : "warn",
    detail:
      !title || !h1
        ? "Can't compare title and H1 — one of them is missing."
        : consistentEntity
        ? "Title tag and H1 describe the same thing consistently."
        : "Title tag and H1 diverge significantly. Keep entity/product naming consistent across title, H1, and schema so AI systems don't get conflicting signals.",
    weight: 1,
  });

  const score = scoreFromFindings(findings);
  return {
    key: "geo",
    name: "GEO (AI Search)",
    score,
    grade: gradeFromScore(score),
    summary:
      "Generative Engine Optimization: how easily AI answer engines (ChatGPT, Perplexity, AI Overviews, Claude) can understand, extract, and cite this page.",
    findings,
  };
}
