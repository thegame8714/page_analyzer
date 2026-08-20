import { CheerioDoc, getJsonLdBlocks, getVisibleText, jsonLdTypes } from "./dom";
import { CTA_PATTERN, countLeadCaptureFields } from "./cta";
import { CategoryResult, Finding, gradeFromScore, scoreFromFindings } from "./types";

// English-only keyword matching false-negatives on any non-English page (e.g. an
// Italian page saying "Testimonianza" / "Storie di successo" was reported as having
// "no testimonials"). Covers the languages most likely to show up; still not
// exhaustive, so it's paired with a video-embed count as a language-independent signal.
const TESTIMONIAL_PATTERN =
  /\b(testimonial|review|what our customers|customer stories|case stud(y|ies)|success stor(y|ies)|testimonianz\w*|recension\w*|storie? di successo|caso studio|casi studio|dicono di noi|témoignages?|avis clients?|études? de cas|ce que disent|testimonios?|reseñas?|casos de éxito|lo que dicen|kundenstimmen|erfahrungsberichte|erfolgsgeschichten|bewertungen|depoimentos?|avalia(ç|c)(ã|a)o(es)?|casos de sucesso)\b/i;
const VIDEO_EMBED_SELECTOR =
  'iframe[src*="youtube"], iframe[src*="youtu.be"], iframe[src*="vimeo"], iframe[src*="wistia"], iframe[src*="loom.com"]';
const SOCIAL_PROOF_NUMBER_PATTERN =
  /\b\d[\d,.]*\+?\s*(customers|users|companies|teams|reviews|ratings|downloads|installs|clients|stars|countries|partecipanti|iscritti|studenti|clienti|valutazione|recensioni|stelle|paesi|edizion\w*|follower|participantes|calificaci(ó|o)n|estrellas|pa(í|i)ses|participants|avis|(é|e)toiles|pays|teilnehmer|bewertung|sterne|l(ä|a)nder|avalia(ç|c)(ã|a)o|estrelas)\b/i;
// Only phrases that are inherently positive on their own (a guarantee/promise),
// not bare words like "refund" — "il biglietto NON è rimborsabile" (the ticket
// is NOT refundable) contains "refund" but means the opposite of risk reversal,
// so a bare keyword match would misread a no-refund policy as a guarantee.
const RISK_REVERSAL_PATTERN =
  /\b(money[-\s]?back|guarantee|free trial|cancel anytime|no credit card|risk[-\s]?free|full refund|100% refund|soddisfatti o rimborsati|garanzia|prova gratuita|disdici quando vuoi|nessuna carta di credito|senza rischio|senza rischi|rimborso garantito|rimborso completo)\b/i;
// "Transferable/cedibile" is a distinct, milder risk-mitigator some businesses
// offer instead of refunds (e.g. non-refundable event tickets that can still
// be passed to someone else) — tracked separately so it's never conflated
// with an actual money-back guarantee.
const TRANSFERABLE_PATTERN =
  /\b(transferable|transfer your (ticket|booking|order|spot)|give your (ticket|spot) (to|away)|cedibile|pu[òo] essere cedut[oa]|trasferibile|cambio( di)? nominativo)\b/i;
const URGENCY_PATTERN =
  /\b(limited time|today only|ends soon|spots left|only \d+ left|hurry|last chance|offer expires|early bird|price increases|prezzo aumenta|scade tra|scade il|scadenza|posti limitati|ultimi posti|affrettati|ultima possibilit(à|a)|offerta a tempo|solo per oggi)\b/i;

export function analyzeConversion(
  $: CheerioDoc,
  htmlSizeBytes: number,
  fetchMs: number
): CategoryResult {
  const findings: Finding[] = [];
  const bodyText = getVisibleText($);

  const jsonLd = getJsonLdBlocks($);
  const types = jsonLdTypes(jsonLd).map((t) => t.toLowerCase());
  const hasRatingSchema = types.some((t) => t.includes("aggregaterating") || t.includes("review"));
  const hasTestimonialText = TESTIMONIAL_PATTERN.test(bodyText);
  const videoEmbedCount = $(VIDEO_EMBED_SELECTOR).length;
  const hasVideoTestimonials = videoEmbedCount >= 2;
  const hasSocialProof = hasRatingSchema || hasTestimonialText || hasVideoTestimonials;
  findings.push({
    id: "social-proof",
    label: "Testimonials / reviews",
    status: hasSocialProof ? "pass" : "fail",
    detail: hasRatingSchema
      ? "Found rating schema — a strong trust signal for conversion."
      : hasTestimonialText
      ? "Found testimonial/review content — a strong trust signal for conversion."
      : hasVideoTestimonials
      ? `Found ${videoEmbedCount} embedded videos, likely video testimonials — a strong trust signal (though we can't verify their content from static HTML).`
      : "No testimonials, reviews, case studies, or embedded testimonial videos detected. Social proof is one of the highest-leverage trust builders on a landing page.",
    weight: 3,
  });

  const hasSocialProofNumbers = SOCIAL_PROOF_NUMBER_PATTERN.test(bodyText);
  findings.push({
    id: "social-proof-numbers",
    label: "Quantified social proof",
    status: hasSocialProofNumbers ? "pass" : "warn",
    detail: hasSocialProofNumbers
      ? "Found a specific quantified claim (e.g. '10,000+ customers', '4.9 stars')."
      : "No quantified social proof found (customer counts, ratings, install numbers). Specific numbers are more persuasive than vague claims.",
    weight: 1,
  });

  const hasRiskReversal = RISK_REVERSAL_PATTERN.test(bodyText);
  findings.push({
    id: "risk-reversal",
    label: "Guarantee / risk reversal",
    status: hasRiskReversal ? "pass" : "warn",
    detail: hasRiskReversal
      ? "Found a guarantee, free trial, or risk-reversal statement, which lowers the perceived cost of converting."
      : "No guarantee, free trial, or 'cancel anytime' style statement found. Reducing perceived risk usually lifts conversion.",
    weight: 2,
  });

  const hasTransferability = !hasRiskReversal && TRANSFERABLE_PATTERN.test(bodyText);
  if (hasTransferability) {
    findings.push({
      id: "transferability",
      label: "Transferable / flexible booking",
      status: "pass",
      detail:
        "No money-back guarantee, but found transferable-ticket/booking language — a milder form of risk mitigation for visitors worried about committing.",
      weight: 1,
    });
  }

  const hasUrgency = URGENCY_PATTERN.test(bodyText);
  findings.push({
    id: "urgency",
    label: "Urgency / scarcity",
    status: hasUrgency ? "pass" : "info",
    detail: hasUrgency
      ? "Found urgency/scarcity messaging, which can lift conversion when genuine."
      : "No urgency or scarcity messaging found. Optional, but genuine urgency (limited spots, deadline) often lifts conversion.",
    weight: 1,
  });

  const h1 = $("h1").first().text().trim();
  const h1WordCount = h1 ? h1.split(/\s+/).length : 0;
  findings.push({
    id: "value-proposition",
    label: "Headline value proposition",
    status: !h1 ? "fail" : h1WordCount >= 3 && h1WordCount <= 14 ? "pass" : "warn",
    detail: !h1
      ? "No H1 headline found to carry the core value proposition."
      : h1WordCount >= 3 && h1WordCount <= 14
      ? `Headline "${h1}" is a focused length (${h1WordCount} words).`
      : `Headline "${h1}" is ${h1WordCount} words — very short or long headlines often fail to communicate a clear value proposition.`,
    weight: 3,
  });

  const bodyChildren = $("body").find("*");
  const totalNodes = bodyChildren.length || 1;
  let firstCtaIndex = -1;
  bodyChildren.each((i, el) => {
    if (firstCtaIndex !== -1) return;
    const tag = el.tagName?.toLowerCase();
    if (tag === "a" || tag === "button") {
      const text = $(el).text().trim();
      if (text && text.length < 40 && CTA_PATTERN.test(text)) {
        firstCtaIndex = i;
      }
    }
  });
  const ctaFoldRatio = firstCtaIndex === -1 ? 1 : firstCtaIndex / totalNodes;
  findings.push({
    id: "above-fold-cta",
    label: "Above-the-fold call-to-action",
    status: firstCtaIndex === -1 ? "fail" : ctaFoldRatio <= 0.35 ? "pass" : "warn",
    detail:
      firstCtaIndex === -1
        ? "Couldn't find a clear CTA button/link early in the page."
        : ctaFoldRatio <= 0.35
        ? "A call-to-action appears early in the page, likely visible without much scrolling."
        : "The first call-to-action appears fairly deep in the page. Visitors shouldn't have to scroll far to find how to act.",
    weight: 2,
  });

  const viewport = $('meta[name="viewport"]').attr("content");
  findings.push({
    id: "mobile-ux",
    label: "Mobile experience readiness",
    status: viewport ? "pass" : "fail",
    detail: viewport
      ? "Responsive viewport tag present, a baseline requirement for mobile conversion."
      : "No responsive viewport meta tag — over half of visitors on mobile may see a broken layout.",
    weight: 2,
  });

  const scriptCount = $("script[src]").length;
  const stylesheetCount = $('link[rel="stylesheet"]').length;
  const imageCount = $("img").length;
  const resourceCount = scriptCount + stylesheetCount + imageCount;
  const sizeKb = htmlSizeBytes / 1024;
  findings.push({
    id: "page-weight",
    label: "Estimated page weight & speed",
    status:
      sizeKb <= 300 && fetchMs <= 1500
        ? "pass"
        : sizeKb <= 800 && fetchMs <= 3000
        ? "warn"
        : "fail",
    detail: `HTML document is ${sizeKb.toFixed(0)}KB with ${resourceCount} linked resource(s) (${scriptCount} scripts, ${stylesheetCount} stylesheets, ${imageCount} images); server responded in ${fetchMs}ms. A 0.1s speed improvement can lift conversion 8-10%, and over half of mobile visitors abandon pages that take 3+s to load.`,
    weight: 2,
  });

  const formCount = $("form").length;
  const looseLeadFields = formCount === 0 ? countLeadCaptureFields($, $.root()) : 0;
  const primaryCtaCount = $("a, button").filter((_, el) => {
    const text = $(el).text().trim();
    return text.length > 0 && text.length < 40 && CTA_PATTERN.test(text);
  }).length;
  const hasConversionPath = formCount > 0 || looseLeadFields > 0 || primaryCtaCount > 0;
  findings.push({
    id: "conversion-path",
    label: "Conversion path presence",
    status: hasConversionPath ? "pass" : "fail",
    detail: hasConversionPath
      ? `Found ${formCount > 0 ? formCount + " form(s)" : looseLeadFields + " input field(s)"} and ${primaryCtaCount} CTA element(s) — visitors have a clear way to convert.`
      : "No form or CTA element found — there's no obvious way for a visitor to convert on this page.",
    weight: 3,
  });

  const score = scoreFromFindings(findings);
  return {
    key: "conversion",
    name: "Conversion Readiness",
    score,
    grade: gradeFromScore(score),
    summary: "Persuasion, trust, and usability signals that influence whether a visitor takes action.",
    findings,
  };
}
