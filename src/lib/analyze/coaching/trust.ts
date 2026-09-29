import { getJsonLdBlocks, jsonLdTypes } from "../dom";
import { splitWords } from "../textUtils";
import { CategoryResult, Finding, tr } from "../types";
import { CoachingContext, category, firstMatch, matchItems } from "./context";
import {
  BUSINESS_ID,
  CREDENTIALS,
  EARNINGS_DISCLAIMER,
  HYPE,
  INCOME_CLAIM,
  MEDIA,
  PRIVACY_LINK,
  RESULT_LANGUAGE,
  TERMS_LINK,
  distinctMatches,
} from "./patterns";
import { STANDARDS } from "./standards";

// Page builders name testimonial blocks in many ways; this catches the common
// ones (Kajabi, Systeme.io, ClickFunnels, Elementor, Webflow, hand-rolled).
const TESTIMONIAL_SELECTOR = [
  "blockquote",
  '[class*="testimonial" i]',
  '[id*="testimonial" i]',
  '[class*="review" i]',
  '[class*="recension" i]',
  '[class*="testimonianz" i]',
  '[class*="quote" i]',
  '[class*="feedback" i]',
  '[class*="success-stor" i]',
  '[class*="case-stud" i]',
].join(", ");

const TESTIMONIAL_HEADING =
  /testimonial|review|success stor|case stud|what (?:our )?(?:clients|students|members) say|results|testimonianz|recension|dicono di (?:noi|me)|storie di successo|risultati|casi studio|testimonios|témoignages|erfahrungen|depoimentos/i;

const VIDEO_SELECTOR =
  'iframe[src*="youtube"], iframe[src*="youtu.be"], iframe[src*="vimeo"], iframe[src*="wistia"], iframe[src*="loom.com"], iframe[src*="vidalytics"], iframe[src*="bunny"], video';

/**
 * Proof & trust — the "perceived likelihood of achievement" half of Hormozi's
 * equation, Cialdini's social-proof and authority principles, Google's
 * E-E-A-T, and the FTC rules that apply to coaching testimonials and income
 * claims.
 */
export function analyzeTrust(ctx: CoachingContext): CategoryResult {
  const { $, bodyText, finalUrl, html } = ctx;
  const findings: Finding[] = [];

  // --- Testimonials ---
  const blocks = $(TESTIMONIAL_SELECTOR)
    .filter((_, el) => $(el).find(TESTIMONIAL_SELECTOR).length === 0)
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((t) => splitWords(t).length >= 8);
  const testimonialHeading = TESTIMONIAL_HEADING.test(ctx.headingText);
  const videos = $(VIDEO_SELECTOR).length;
  const testimonialCount = blocks.length;
  findings.push({
    id: "testimonial-volume",
    label: tr("Volume of client testimonials", "Quantità di testimonianze dei clienti"),
    status: testimonialCount >= 6 ? "pass" : testimonialCount >= 3 || testimonialHeading || videos >= 2 ? "warn" : "fail",
    detail:
      testimonialCount >= 6
        ? tr(
            `${testimonialCount} testimonial blocks found. A "wall of proof" is standard on the best coaching sales pages.`,
            `${testimonialCount} testimonianze trovate. Un "muro di prove" è la norma nelle migliori pagine di vendita di coaching.`
          )
        : testimonialCount >= 3
        ? tr(
            `${testimonialCount} testimonial blocks found. Top coaching pages show 6-20+, spread through the page (not just one section).`,
            `${testimonialCount} testimonianze trovate. Le migliori pagine di coaching ne mostrano 6-20+, distribuite in tutta la pagina (non in una sola sezione).`
          )
        : testimonialHeading || videos >= 2
        ? tr(
            `A testimonials section appears to exist${videos ? ` (${videos} embedded video${videos > 1 ? "s" : ""})` : ""}, but few text testimonials were detected. Add more written ones: they're scannable and indexable.`,
            `Sembra esserci una sezione testimonianze${videos ? ` (${videos} video incorporat${videos > 1 ? "i" : "o"})` : ""}, ma le testimonianze scritte sono poche. Aggiungine altre: si leggono in fretta e sono indicizzabili.`
          )
        : tr(
            "No client testimonials detected. For coaching, proof from people like the reader is the single strongest persuasion element.",
            "Nessuna testimonianza di clienti. Nel coaching, la prova di persone simili al lettore è l'elemento di persuasione più forte in assoluto."
          ),
    weight: 3,
    standard: STANDARDS.cialdini,
  });

  const testimonialText = blocks.join(" ");
  const resultSource = testimonialText || bodyText;
  const results = distinctMatches(resultSource, RESULT_LANGUAGE);
  findings.push({
    id: "results-testimonials",
    label: tr("Testimonials show specific results", "Le testimonianze mostrano risultati specifici"),
    status: results.length >= 3 ? "pass" : results.length >= 1 ? "warn" : "fail",
    detail:
      results.length >= 3
        ? tr(
            `Proof is specific and outcome-based (${results.slice(0, 4).map((r) => `"${r}"`).join(", ")}). Specific before → after results beat generic praise.`,
            `Le prove sono specifiche e basate sui risultati (${results.slice(0, 4).map((r) => `"${r}"`).join(", ")}). Risultati prima → dopo specifici battono gli elogi generici.`
          )
        : results.length >= 1
        ? tr(
            `Only a little outcome-specific proof ("${results[0]}"). Rewrite testimonials as before → after with numbers and timeframes ("from 0 to 5 clients in 8 weeks").`,
            `Poche prove con risultati specifici ("${results[0]}"). Riscrivi le testimonianze come prima → dopo, con numeri e tempi ("da 0 a 5 clienti in 8 settimane").`
          )
        : tr(
            "Testimonials (if any) are generic praise (\"amazing coach!\"). Coaching buyers need specific, measurable transformations from people like them.",
            "Le testimonianze (se ci sono) sono elogi generici (\"coach fantastico!\"). Chi compra coaching ha bisogno di trasformazioni specifiche e misurabili di persone simili a sé."
          ),
    weight: 3,
    standard: STANDARDS.hormozi,
    items: results.length > 0 ? matchItems(finalUrl, results) : undefined,
  });

  findings.push({
    id: "video-proof",
    label: tr("Video testimonials / coach video", "Videotestimonianze / video del coach"),
    status: videos >= 2 ? "pass" : "warn",
    detail:
      videos >= 2
        ? tr(
            `${videos} embedded videos found. Video testimonials and a coach intro video are the hardest proof to fake.`,
            `${videos} video incorporati. Le videotestimonianze e un video di presentazione del coach sono le prove più difficili da falsificare.`
          )
        : videos === 1
        ? tr(
            "One video found. Add short (30-90s) client video testimonials; they convert far better than text alone.",
            "Un solo video. Aggiungi brevi videotestimonianze di clienti (30-90 s): convertono molto meglio del solo testo."
          )
        : tr(
            "No embedded video. A coach intro video and a few client video testimonials are standard on top coaching sales pages.",
            "Nessun video. Un video di presentazione del coach e qualche videotestimonianza sono la norma nelle migliori pagine di coaching."
          ),
    weight: 2,
    standard: STANDARDS.cialdini,
  });

  const testimonialImages = $(TESTIMONIAL_SELECTOR).find("img").length;
  if (testimonialCount > 0) {
    findings.push({
      id: "testimonial-attribution",
      label: tr("Testimonials have faces & names", "Testimonianze con volti e nomi"),
      status: testimonialImages >= Math.min(3, testimonialCount) ? "pass" : "warn",
      detail:
        testimonialImages >= Math.min(3, testimonialCount)
          ? tr(
              `${testimonialImages} photos inside testimonial blocks. Faces plus full names make proof believable.`,
              `${testimonialImages} foto nelle testimonianze. Volti e nomi completi rendono le prove credibili.`
            )
          : tr(
              "Few or no photos alongside testimonials. Add a headshot, full name and role/location to each one. Anonymous testimonials read as fake.",
              "Poche o nessuna foto accanto alle testimonianze. Aggiungi a ciascuna foto, nome completo e ruolo/città. Le testimonianze anonime sembrano false."
            ),
      weight: 1,
      standard: STANDARDS.ftc,
    });
  }

  // --- Authority ---
  const credentials = firstMatch(bodyText, CREDENTIALS);
  findings.push({
    id: "credentials",
    label: tr("Coach credentials & experience", "Credenziali ed esperienza del coach"),
    status: credentials ? "pass" : "warn",
    detail: credentials
      ? tr(
          `Credentials/experience stated ("${credentials}"). Specific qualifications and client numbers make the coach a credible guide.`,
          `Credenziali/esperienza indicate ("${credentials}"). Qualifiche specifiche e numeri di clienti rendono il coach una guida credibile.`
        )
      : tr(
          "No credentials, certifications or experience numbers found (e.g. \"ICF PCC\", \"10 years of experience\", \"helped 500+ clients\").",
          "Nessuna credenziale, certificazione o numero sull'esperienza (es. \"ICF PCC\", \"10 anni di esperienza\", \"ho aiutato oltre 500 clienti\")."
        ),
    weight: 2,
    standard: STANDARDS.eeat,
  });

  const media = firstMatch(bodyText, MEDIA);
  const logoStrip = $('img[alt*="logo" i], [class*="logo" i] img, [class*="featured" i] img, [class*="press" i] img').length;
  findings.push({
    id: "media",
    label: tr("Media mentions / authority logos", "Citazioni sui media / loghi di autorevolezza"),
    status: media ? "pass" : logoStrip >= 4 ? "warn" : "info",
    detail: media
      ? tr(
          `Third-party authority found ("${media}"). "As seen in" logos borrow trust from recognised brands.`,
          `Autorevolezza di terze parti presente ("${media}"). I loghi "Visto su" prendono in prestito la fiducia di brand riconosciuti.`
        )
      : logoStrip >= 4
      ? tr(
          `${logoStrip} logo images found but no "as seen in / featured in" label. Label the strip so its meaning is clear.`,
          `${logoStrip} loghi trovati, ma senza la dicitura "Visto su / Parlano di noi". Etichetta la striscia così il significato è chiaro.`
        )
      : tr(
          "No media, podcast or stage appearances shown. Optional, but \"As seen in\" logos are a common trust booster.",
          "Nessuna apparizione su media, podcast o palchi. Facoltativo, ma i loghi \"Visto su\" aumentano spesso la fiducia."
        ),
    weight: 1,
    standard: STANDARDS.cialdini,
  });

  const types = jsonLdTypes(getJsonLdBlocks($)).map((t) => t.toLowerCase());
  const hasRatingSchema = types.some((t) => t.includes("aggregaterating") || t === "review");
  const ratingText = firstMatch(bodyText, /\d(?:[.,]\d)?\s?(?:\/\s?5|out of 5|stars?|stelle|su 5)|trustpilot|google reviews|recensioni google/i);
  findings.push({
    id: "ratings",
    label: tr("Aggregate rating / third-party reviews", "Valutazione media / recensioni di terze parti"),
    status: hasRatingSchema || ratingText ? "pass" : "info",
    detail: hasRatingSchema
      ? tr(
          "Rating/review structured data found. Eligible for star-rich results and trusted by AI engines.",
          "Dati strutturati di valutazioni/recensioni presenti: idonei ai risultati con stelline e considerati affidabili dai motori AI."
        )
      : ratingText
      ? tr(`An aggregate rating or review platform is referenced ("${ratingText}").`, `Citata una valutazione media o una piattaforma di recensioni ("${ratingText}").`)
      : tr(
          "No aggregate rating (e.g. 4.9/5 from 312 students) or third-party review platform (Trustpilot, Google). Optional, but independent ratings are strong proof.",
          "Nessuna valutazione media (es. 4,9/5 da 312 studenti) né piattaforma di recensioni esterna (Trustpilot, Google). Facoltativo, ma le valutazioni indipendenti sono una prova forte."
        ),
    weight: 1,
    standard: STANDARDS.cialdini,
  });

  // --- Compliance ---
  const incomeClaim = firstMatch(bodyText, INCOME_CLAIM);
  const disclaimer = firstMatch(bodyText, EARNINGS_DISCLAIMER);
  findings.push({
    id: "income-disclaimer",
    label: tr("Income / results claims are disclosed", "Dichiarazioni su guadagni/risultati con disclaimer"),
    status: !incomeClaim ? (disclaimer ? "pass" : "info") : disclaimer ? "pass" : "fail",
    detail: !incomeClaim
      ? disclaimer
        ? tr("A results disclaimer is present.", "È presente un disclaimer sui risultati.")
        : tr(
            "No income claims detected, so no earnings disclaimer is strictly needed. Consider a \"results vary\" note if testimonials cite specific outcomes.",
            "Nessuna promessa di guadagno, quindi il disclaimer non è strettamente necessario. Valuta una nota \"i risultati possono variare\" se le testimonianze citano risultati specifici."
          )
      : disclaimer
      ? tr(
          `Income/results claim ("${incomeClaim}") is paired with a disclaimer. Good: the FTC requires typical results to be disclosed alongside atypical ones.`,
          `La promessa di guadagno/risultato ("${incomeClaim}") è accompagnata da un disclaimer. Bene: la FTC richiede di indicare i risultati tipici accanto a quelli eccezionali.`
        )
      : tr(
          `The page makes an income/results claim ("${incomeClaim}") but has no earnings disclaimer. The FTC (and Italy's AGCM) treat this as potentially deceptive; add an earnings disclaimer and "results not typical" notes near testimonials.`,
          `La pagina fa una promessa di guadagno/risultato ("${incomeClaim}") ma non ha un disclaimer. La FTC (e in Italia l'AGCM) la considerano potenzialmente ingannevole: aggiungi un disclaimer sui guadagni e note "risultati non tipici" vicino alle testimonianze.`
        ),
    weight: 2,
    standard: STANDARDS.ftc,
  });

  // "Not for you if you want easy money" uses hype words to reject them —
  // skip matches with a negation just before them.
  const NEGATION = /(?<![\p{L}])(?:not|no|never|don't|won't|isn't|aren't|non|mai|niente|nessun[oa]?|nada|pas|nicht|kein\w*)(?![\p{L}])[^.!?]{0,30}$/iu;
  const hype = Array.from(
    new Set(
      Array.from(bodyText.matchAll(HYPE))
        .filter((m) => !NEGATION.test(bodyText.slice(Math.max(0, (m.index ?? 0) - 40), m.index)))
        .map((m) => m[0].toLowerCase())
    )
  );
  const words = splitWords(bodyText);
  const exclamations = (bodyText.match(/!/g) ?? []).length;
  const capsWords = words.filter((w) => w.length >= 4 && w === w.toUpperCase() && /\p{L}/u.test(w)).length;
  const exclamationRate = (exclamations / Math.max(1, words.length)) * 100;
  const capsRate = (capsWords / Math.max(1, words.length)) * 100;
  const hypeScore = hype.length + (exclamationRate > 1 ? 1 : 0) + (capsRate > 3 ? 1 : 0);
  findings.push({
    id: "hype",
    label: tr("No hype / red-flag claims", "Niente esagerazioni / affermazioni sospette"),
    status: hypeScore === 0 ? "pass" : hypeScore <= 1 ? "warn" : "fail",
    detail:
      hypeScore === 0
        ? tr(
            "Copy avoids hype and guaranteed-outcome claims. In 2026, buyers are wary of \"bro-marketing\"; credibility converts better.",
            "Il testo evita esagerazioni e risultati garantiti. Nel 2026 chi compra diffida del \"bro-marketing\": la credibilità converte meglio."
          )
        : tr(
            `Trust-eroding signals: ${[
              hype.length ? `hype phrases (${hype.slice(0, 3).map((h) => `"${h}"`).join(", ")})` : "",
              exclamationRate > 1 ? `${exclamations} exclamation marks (${exclamationRate.toFixed(1)} per 100 words)` : "",
              capsRate > 3 ? `${capsRate.toFixed(0)}% ALL-CAPS words` : "",
            ]
              .filter(Boolean)
              .join("; ")}. Replace them with specific, verifiable claims.`,
            `Segnali che erodono la fiducia: ${[
              hype.length ? `frasi esagerate (${hype.slice(0, 3).map((h) => `"${h}"`).join(", ")})` : "",
              exclamationRate > 1 ? `${exclamations} punti esclamativi (${exclamationRate.toFixed(1)} ogni 100 parole)` : "",
              capsRate > 3 ? `${capsRate.toFixed(0)}% di parole TUTTE MAIUSCOLE` : "",
            ]
              .filter(Boolean)
              .join("; ")}. Sostituiscili con affermazioni specifiche e verificabili.`
          ),
    weight: 2,
    standard: STANDARDS.ftc,
    items: hype.length > 0 ? matchItems(finalUrl, hype) : undefined,
  });

  const linkTexts = $("a")
    .map((_, el) => `${$(el).text()} ${$(el).attr("href") ?? ""}`)
    .get()
    .join(" ");
  const hasPrivacy = PRIVACY_LINK.test(linkTexts);
  const hasTerms = TERMS_LINK.test(linkTexts);
  findings.push({
    id: "legal-pages",
    label: tr("Privacy policy & terms linked", "Link a privacy policy e termini"),
    status: hasPrivacy && hasTerms ? "pass" : hasPrivacy || hasTerms ? "warn" : "fail",
    detail:
      hasPrivacy && hasTerms
        ? tr(
            "Privacy policy and terms/conditions are linked. Required for GDPR, ad platforms and payment processors.",
            "Privacy policy e termini e condizioni sono collegati. Obbligatori per GDPR, piattaforme pubblicitarie e processori di pagamento."
          )
        : tr(
            `Missing ${[!hasPrivacy && "privacy policy", !hasTerms && "terms & conditions / refund policy"].filter(Boolean).join(" and ")} link. Meta/Google ads and Stripe expect these, and so does GDPR when you collect emails.`,
            `Manca il link a ${[!hasPrivacy && "privacy policy", !hasTerms && "termini e condizioni / politica di rimborso"].filter(Boolean).join(" e ")}. Le inserzioni Meta/Google e Stripe li richiedono, così come il GDPR quando raccogli email.`
          ),
    weight: 2,
    standard: STANDARDS.euConsumer,
  });

  const businessId = firstMatch(bodyText, BUSINESS_ID);
  const hasContact = /mailto:|tel:/i.test(html) || /[\w.+-]+@[\w-]+\.[\w.]+/.test(bodyText);
  const needsVat = ctx.language.code === "it";
  findings.push({
    id: "business-identity",
    label: tr("Real business identity & contact", "Identità aziendale reale e contatti"),
    status: hasContact && (!needsVat || businessId) ? "pass" : hasContact || businessId ? "warn" : "fail",
    detail:
      hasContact && (!needsVat || businessId)
        ? tr(
            `A way to contact the coach${businessId ? ` and business ID ("${businessId}")` : ""} is shown. It tells buyers a real, accountable business is behind the offer.`,
            `Sono indicati un modo per contattare il coach${businessId ? ` e i dati aziendali ("${businessId}")` : ""}. Dicono a chi compra che dietro l'offerta c'è un'attività reale e responsabile.`
          )
        : needsVat && !businessId
        ? tr(
            `No Partita IVA (VAT number) found${hasContact ? "" : " and no email/phone"}. Italian law requires the VAT number on business websites, and it's a basic trust signal.`,
            `Nessuna Partita IVA${hasContact ? "" : " né email/telefono"}. La legge italiana richiede la P.IVA sui siti aziendali, ed è un segnale di fiducia di base.`
          )
        : tr(
            "No email, phone or contact link found. Buyers of a high-trust service need to know how to reach a real person.",
            "Nessuna email, telefono o link di contatto. Chi acquista un servizio basato sulla fiducia deve sapere come raggiungere una persona reale."
          ),
    weight: 1,
    standard: STANDARDS.euConsumer,
  });

  return category(
    "trust",
    tr("Trust & Proof", "Fiducia e prove"),
    tr(
      "Social proof, coach authority and compliance: result-specific testimonials, video proof, credentials, earnings disclaimers (FTC) and legal pages.",
      "Riprova sociale, autorevolezza del coach e conformità: testimonianze con risultati specifici, video, credenziali, disclaimer sui guadagni (FTC) e pagine legali."
    ),
    findings
  );
}
