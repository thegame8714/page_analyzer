import { CheerioDoc, absoluteUrl, getHeadings, getJsonLdBlocks } from "./dom";
import { isLocalUrl } from "./normalizeUrl";
import { CategoryResult, Finding, FindingItem, Product, gradeFromScore, scoreFromFindings, tr } from "./types";

const MAX_ITEMS = 25;

// Search demand for coaching offers is keyword-led ("business coaching
// program", "percorso di coaching"); a title without any niche term can't
// rank for it no matter how good the page is.
const NICHE_TERMS =
  /coach\w*|mentor\w*|program\w*|course|masterclass|academy|bootcamp|mastermind|training|percorso|corso|formazione|accademia|curso|formation|kurs|programa/i;

export function analyzeSeo($: CheerioDoc, finalUrl: string, product: Product): CategoryResult {
  const findings: Finding[] = [];
  const titleLabel = tr("Title tag", "Tag title");

  const title = $("title").first().text().trim();
  if (!title) {
    findings.push({
      id: "title-missing",
      label: titleLabel,
      status: "fail",
      detail: tr("No <title> tag found. Every page needs a unique, descriptive title.", "Nessun tag <title>. Ogni pagina ha bisogno di un titolo unico e descrittivo."),
      weight: 3,
    });
  } else if (title.length < 10 || title.length > 65) {
    findings.push({
      id: "title-length",
      label: titleLabel,
      status: "warn",
      detail: tr(
        `Title is ${title.length} characters ("${title}"). Aim for 10-60 characters so it doesn't get truncated in search results.`,
        `Il titolo è di ${title.length} caratteri ("${title}"). Punta a 10-60 caratteri perché non venga troncato nei risultati di ricerca.`
      ),
      weight: 3,
    });
  } else {
    findings.push({
      id: "title-length",
      label: titleLabel,
      status: "pass",
      detail: tr(`Title "${title}" is a good length (${title.length} chars).`, `Il titolo "${title}" ha una buona lunghezza (${title.length} caratteri).`),
      weight: 3,
    });
  }

  if (title && product === "coaching") {
    const niche = title.match(NICHE_TERMS);
    findings.push({
      id: "title-niche",
      label: tr("Offer keyword in title", "Parola chiave dell'offerta nel titolo"),
      status: niche ? "pass" : "warn",
      detail: niche
        ? tr(`Title includes a niche keyword ("${niche[0]}") people search for.`, `Il titolo contiene una parola chiave di nicchia ("${niche[0]}") che le persone cercano.`)
        : tr(
            "Title has no offer keyword (coaching, program, course, percorso…). Include the category + outcome people actually search, e.g. \"Business Coaching Program for New Coaches | Brand\".",
            "Il titolo non contiene una parola chiave dell'offerta (coaching, percorso, corso, programma…). Includi la categoria + il risultato che le persone cercano davvero, es. \"Percorso di Business Coaching per Nuovi Coach | Brand\"."
          ),
      weight: 2,
    });
  }

  const metaLabel = tr("Meta description", "Meta description");
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() ?? "";
  if (!metaDescription) {
    findings.push({
      id: "meta-description",
      label: metaLabel,
      status: "fail",
      detail: tr(
        "No meta description found. Search engines will auto-generate a snippet instead.",
        "Nessuna meta description. I motori di ricerca genereranno uno snippet automaticamente."
      ),
      weight: 3,
    });
  } else if (metaDescription.length < 50 || metaDescription.length > 165) {
    findings.push({
      id: "meta-description",
      label: metaLabel,
      status: "warn",
      detail: tr(
        `Meta description is ${metaDescription.length} characters. Aim for 120-160 characters.`,
        `La meta description è di ${metaDescription.length} caratteri. Punta a 120-160 caratteri.`
      ),
      weight: 3,
    });
  } else {
    findings.push({
      id: "meta-description",
      label: metaLabel,
      status: "pass",
      detail: tr(
        `Meta description length is good (${metaDescription.length} chars).`,
        `La meta description ha una buona lunghezza (${metaDescription.length} caratteri).`
      ),
      weight: 3,
    });
  }

  const headings = getHeadings($);
  const h1s = headings.filter((h) => h.level === 1);
  const h1Label = tr("H1 heading", "Titolo H1");
  if (h1s.length === 0) {
    findings.push({
      id: "h1",
      label: h1Label,
      status: "fail",
      detail: tr(
        "No H1 heading found. Add one clear H1 describing the page's main offer.",
        "Nessun titolo H1. Aggiungi un H1 chiaro che descriva l'offerta principale della pagina."
      ),
      weight: 3,
    });
  } else if (h1s.length > 1) {
    findings.push({
      id: "h1",
      label: h1Label,
      status: "warn",
      detail: tr(
        `Found ${h1s.length} H1 tags. Use exactly one H1 per page for clarity.`,
        `Trovati ${h1s.length} tag H1. Usa un solo H1 per pagina, per chiarezza.`
      ),
      weight: 3,
    });
  } else {
    findings.push({
      id: "h1",
      label: h1Label,
      status: "pass",
      detail: tr(`Exactly one H1 found: "${h1s[0].text.slice(0, 80)}".`, `Un solo H1 presente: "${h1s[0].text.slice(0, 80)}".`),
      weight: 3,
    });
  }

  let skipped = false;
  let prevLevel = 0;
  for (const h of headings) {
    if (prevLevel > 0 && h.level - prevLevel > 1) skipped = true;
    prevLevel = h.level;
  }
  findings.push({
    id: "heading-hierarchy",
    label: tr("Heading hierarchy", "Gerarchia dei titoli"),
    status: headings.length === 0 ? "warn" : skipped ? "warn" : "pass",
    detail:
      headings.length === 0
        ? tr("No headings found on the page.", "Nessun titolo (heading) nella pagina.")
        : skipped
        ? tr(
            "Heading levels skip a level (e.g. H1 to H3), which hurts structure and accessibility.",
            "I livelli dei titoli saltano un livello (es. da H1 a H3), a scapito di struttura e accessibilità."
          )
        : tr(`${headings.length} headings found with a logical hierarchy.`, `${headings.length} titoli con una gerarchia logica.`),
    weight: 1,
  });

  const canonical = $('link[rel="canonical"]').attr("href");
  findings.push({
    id: "canonical",
    label: tr("Canonical URL", "URL canonico"),
    status: canonical ? "pass" : "warn",
    detail: canonical
      ? tr(`Canonical URL set to ${canonical}.`, `URL canonico impostato su ${canonical}.`)
      : tr(
          "No canonical link tag. Add one to prevent duplicate-content issues.",
          "Nessun tag canonical. Aggiungilo per evitare problemi di contenuti duplicati."
        ),
    weight: 1,
  });

  const viewport = $('meta[name="viewport"]').attr("content");
  findings.push({
    id: "viewport",
    label: tr("Mobile viewport tag", "Tag viewport mobile"),
    status: viewport ? "pass" : "fail",
    detail: viewport
      ? tr("Responsive viewport meta tag is present.", "Il meta tag viewport responsive è presente.")
      : tr("Missing viewport meta tag — the page may not render well on mobile.", "Manca il meta tag viewport: la pagina potrebbe non visualizzarsi bene su mobile."),
    weight: 2,
  });

  const images = $("img");
  const totalImages = images.length;
  let missingAlt = 0;
  const missingAltItems: FindingItem[] = [];
  images.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt && alt.trim()) return;
    missingAlt += 1;
    const src = $(el).attr("src") || $(el).attr("data-src");
    const resolved = src ? absoluteUrl(src, finalUrl) : null;
    if (missingAltItems.length >= MAX_ITEMS) return;
    let label: FindingItem["text"] = resolved ?? tr("Image with no src attribute", "Immagine senza attributo src");
    if (resolved) {
      try {
        const filename = new URL(resolved).pathname.split("/").pop();
        if (filename) label = filename;
      } catch {
        // keep full resolved URL as the label
      }
    }
    missingAltItems.push({ text: label, href: resolved ?? undefined });
  });
  if (missingAlt > MAX_ITEMS) {
    missingAltItems.push({ text: tr(`…and ${missingAlt - MAX_ITEMS} more.`, `…e altre ${missingAlt - MAX_ITEMS}.`) });
  }
  const altLabel = tr("Image alt text", "Testo alternativo delle immagini");
  if (totalImages === 0) {
    findings.push({
      id: "image-alt",
      label: altLabel,
      status: "info",
      detail: tr("No images found on the page.", "Nessuna immagine nella pagina."),
      weight: 2,
    });
  } else {
    const coverage = 1 - missingAlt / totalImages;
    const pct = Math.round(coverage * 100);
    findings.push({
      id: "image-alt",
      label: altLabel,
      status: coverage === 1 ? "pass" : coverage >= 0.7 ? "warn" : "fail",
      detail: tr(
        `${totalImages - missingAlt}/${totalImages} images have alt text (${pct}%).`,
        `${totalImages - missingAlt}/${totalImages} immagini hanno il testo alternativo (${pct}%).`
      ),
      weight: 2,
      items: missingAltItems.length > 0 ? missingAltItems : undefined,
    });
  }

  const jsonLd = getJsonLdBlocks($);
  findings.push({
    id: "structured-data",
    label: tr("Structured data (JSON-LD)", "Dati strutturati (JSON-LD)"),
    status: jsonLd.length > 0 ? "pass" : "warn",
    detail:
      jsonLd.length > 0
        ? tr(
            `${jsonLd.length} JSON-LD block(s) found, helping search engines understand the page.`,
            `${jsonLd.length} blocchi JSON-LD trovati: aiutano i motori di ricerca a capire la pagina.`
          )
        : tr(
            "No JSON-LD structured data found. Adding schema.org markup improves rich results.",
            "Nessun dato strutturato JSON-LD. Aggiungere il markup schema.org migliora i risultati arricchiti."
          ),
    weight: 2,
  });

  const ogTags = ["og:title", "og:description", "og:image"].filter((p) => !!$(`meta[property="${p}"]`).attr("content"));
  findings.push({
    id: "open-graph",
    label: tr("Open Graph tags", "Tag Open Graph"),
    status: ogTags.length === 3 ? "pass" : ogTags.length > 0 ? "warn" : "fail",
    detail: tr(
      `${ogTags.length}/3 core Open Graph tags present (og:title, og:description, og:image). These control link previews on social shares.`,
      `${ogTags.length}/3 tag Open Graph principali presenti (og:title, og:description, og:image). Controllano l'anteprima del link quando viene condiviso sui social.`
    ),
    weight: 1,
  });

  const robots = $('meta[name="robots"]').attr("content") ?? "";
  const blocksIndexing = /noindex/i.test(robots);
  findings.push({
    id: "robots",
    label: tr("Indexability", "Indicizzabilità"),
    status: blocksIndexing ? "fail" : "pass",
    detail: blocksIndexing
      ? tr(
          `Robots meta tag contains "${robots}" — this page is blocked from search indexing.`,
          `Il meta tag robots contiene "${robots}": la pagina è esclusa dall'indicizzazione.`
        )
      : tr("Page is indexable (no noindex directive).", "La pagina è indicizzabile (nessuna direttiva noindex)."),
    weight: 2,
  });

  const lang = $("html").attr("lang");
  findings.push({
    id: "lang",
    label: tr("Language attribute", "Attributo lingua"),
    status: lang ? "pass" : "warn",
    detail: lang
      ? tr(`<html lang="${lang}"> is set.`, `<html lang="${lang}"> è impostato.`)
      : tr(
          "Missing lang attribute on <html>, which helps search engines and screen readers.",
          "Manca l'attributo lang su <html>, utile a motori di ricerca e screen reader."
        ),
    weight: 1,
  });

  const isHttps = finalUrl.startsWith("https://");
  const isLocal = isLocalUrl(finalUrl);
  findings.push({
    id: "https",
    label: tr("HTTPS", "HTTPS"),
    // A local dev server is normally plain http — that says nothing about
    // how the deployed page will be served, so don't penalize it.
    status: isHttps ? "pass" : isLocal ? "info" : "fail",
    detail: isHttps
      ? tr("Page is served over HTTPS.", "La pagina è servita tramite HTTPS.")
      : isLocal
      ? tr(
          "Local page, so HTTPS isn't checked. Make sure the deployed site is served over HTTPS.",
          "Pagina locale, quindi l'HTTPS non viene controllato. Assicurati che il sito pubblicato sia servito tramite HTTPS."
        )
      : tr("Page is not served over HTTPS, which hurts trust and rankings.", "La pagina non è servita tramite HTTPS: danneggia fiducia e posizionamento."),
    weight: 2,
  });

  const score = scoreFromFindings(findings);
  return {
    key: "seo",
    name: tr("SEO", "SEO"),
    score,
    grade: gradeFromScore(score),
    summary: tr("Traditional on-page search engine optimization signals.", "Segnali classici di ottimizzazione on-page per i motori di ricerca."),
    findings,
  };
}
