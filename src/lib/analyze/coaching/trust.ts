import { getJsonLdBlocks, jsonLdTypes } from "../dom";
import { splitWords } from "../textUtils";
import { CategoryResult, Finding } from "../types";
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
    label: "Volume of client testimonials",
    status: testimonialCount >= 6 ? "pass" : testimonialCount >= 3 || testimonialHeading || videos >= 2 ? "warn" : "fail",
    detail:
      testimonialCount >= 6
        ? `${testimonialCount} testimonial blocks found. A "wall of proof" is standard on the best coaching sales pages.`
        : testimonialCount >= 3
        ? `${testimonialCount} testimonial blocks found. Top coaching pages show 6-20+, spread through the page (not just one section).`
        : testimonialHeading || videos >= 2
        ? `A testimonials section appears to exist${videos ? ` (${videos} embedded video${videos > 1 ? "s" : ""})` : ""}, but few text testimonials were detected. Add more written ones: they're scannable and indexable.`
        : "No client testimonials detected. For coaching, proof from people like the reader is the single strongest persuasion element.",
    weight: 3,
    standard: STANDARDS.cialdini,
  });

  const testimonialText = blocks.join(" ");
  const resultSource = testimonialText || bodyText;
  const results = distinctMatches(resultSource, RESULT_LANGUAGE);
  findings.push({
    id: "results-testimonials",
    label: "Testimonials show specific results",
    status: results.length >= 3 ? "pass" : results.length >= 1 ? "warn" : "fail",
    detail:
      results.length >= 3
        ? `Proof is specific and outcome-based (${results.slice(0, 4).map((r) => `"${r}"`).join(", ")}). Specific before → after results beat generic praise.`
        : results.length >= 1
        ? `Only a little outcome-specific proof ("${results[0]}"). Rewrite testimonials as before → after with numbers and timeframes ("from 0 to 5 clients in 8 weeks").`
        : "Testimonials (if any) are generic praise (\"amazing coach!\"). Coaching buyers need specific, measurable transformations from people like them.",
    weight: 3,
    standard: STANDARDS.hormozi,
    items: results.length > 0 ? matchItems(finalUrl, results) : undefined,
  });

  findings.push({
    id: "video-proof",
    label: "Video testimonials / coach video",
    status: videos >= 2 ? "pass" : "warn",
    detail:
      videos >= 2
        ? `${videos} embedded videos found. Video testimonials and a coach intro video are the hardest proof to fake.`
        : videos === 1
        ? "One video found. Add short (30-90s) client video testimonials; they convert far better than text alone."
        : "No embedded video. A coach intro video and a few client video testimonials are standard on top coaching sales pages.",
    weight: 2,
    standard: STANDARDS.cialdini,
  });

  const testimonialImages = $(TESTIMONIAL_SELECTOR).find("img").length;
  if (testimonialCount > 0) {
    findings.push({
      id: "testimonial-attribution",
      label: "Testimonials have faces & names",
      status: testimonialImages >= Math.min(3, testimonialCount) ? "pass" : "warn",
      detail:
        testimonialImages >= Math.min(3, testimonialCount)
          ? `${testimonialImages} photos inside testimonial blocks. Faces plus full names make proof believable.`
          : "Few or no photos alongside testimonials. Add a headshot, full name and role/location to each one. Anonymous testimonials read as fake.",
      weight: 1,
      standard: STANDARDS.ftc,
    });
  }

  // --- Authority ---
  const credentials = firstMatch(bodyText, CREDENTIALS);
  findings.push({
    id: "credentials",
    label: "Coach credentials & experience",
    status: credentials ? "pass" : "warn",
    detail: credentials
      ? `Credentials/experience stated ("${credentials}"). Specific qualifications and client numbers make the coach a credible guide.`
      : "No credentials, certifications or experience numbers found (e.g. \"ICF PCC\", \"10 anni di esperienza\", \"helped 500+ clients\").",
    weight: 2,
    standard: STANDARDS.eeat,
  });

  const media = firstMatch(bodyText, MEDIA);
  const logoStrip = $('img[alt*="logo" i], [class*="logo" i] img, [class*="featured" i] img, [class*="press" i] img').length;
  findings.push({
    id: "media",
    label: "Media mentions / authority logos",
    status: media ? "pass" : logoStrip >= 4 ? "warn" : "info",
    detail: media
      ? `Third-party authority found ("${media}"). "As seen in" logos borrow trust from recognised brands.`
      : logoStrip >= 4
      ? `${logoStrip} logo images found but no "as seen in / featured in" label. Label the strip so its meaning is clear.`
      : "No media, podcast or stage appearances shown. Optional, but \"As seen in / Visto su\" logos are a common trust booster.",
    weight: 1,
    standard: STANDARDS.cialdini,
  });

  const types = jsonLdTypes(getJsonLdBlocks($)).map((t) => t.toLowerCase());
  const hasRatingSchema = types.some((t) => t.includes("aggregaterating") || t === "review");
  const ratingText = firstMatch(bodyText, /\d(?:[.,]\d)?\s?(?:\/\s?5|out of 5|stars?|stelle|su 5)|trustpilot|google reviews|recensioni google/i);
  findings.push({
    id: "ratings",
    label: "Aggregate rating / third-party reviews",
    status: hasRatingSchema || ratingText ? "pass" : "info",
    detail: hasRatingSchema
      ? "Rating/review structured data found. Eligible for star-rich results and trusted by AI engines."
      : ratingText
      ? `An aggregate rating or review platform is referenced ("${ratingText}").`
      : "No aggregate rating (e.g. 4.9/5 from 312 students) or third-party review platform (Trustpilot, Google). Optional, but independent ratings are strong proof.",
    weight: 1,
    standard: STANDARDS.cialdini,
  });

  // --- Compliance ---
  const incomeClaim = firstMatch(bodyText, INCOME_CLAIM);
  const disclaimer = firstMatch(bodyText, EARNINGS_DISCLAIMER);
  findings.push({
    id: "income-disclaimer",
    label: "Income / results claims are disclosed",
    status: !incomeClaim ? (disclaimer ? "pass" : "info") : disclaimer ? "pass" : "fail",
    detail: !incomeClaim
      ? disclaimer
        ? "A results disclaimer is present."
        : "No income claims detected, so no earnings disclaimer is strictly needed. Consider a \"results vary\" note if testimonials cite specific outcomes."
      : disclaimer
      ? `Income/results claim ("${incomeClaim}") is paired with a disclaimer. Good: the FTC requires typical results to be disclosed alongside atypical ones.`
      : `The page makes an income/results claim ("${incomeClaim}") but has no earnings disclaimer. The FTC (and Italy's AGCM) treat this as potentially deceptive; add an earnings disclaimer and "results not typical" notes near testimonials.`,
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
    label: "No hype / red-flag claims",
    status: hypeScore === 0 ? "pass" : hypeScore <= 1 ? "warn" : "fail",
    detail:
      hypeScore === 0
        ? "Copy avoids hype and guaranteed-outcome claims. In 2026, buyers are wary of \"bro-marketing\"; credibility converts better."
        : `Trust-eroding signals: ${[
            hype.length ? `hype phrases (${hype.slice(0, 3).map((h) => `"${h}"`).join(", ")})` : "",
            exclamationRate > 1 ? `${exclamations} exclamation marks (${exclamationRate.toFixed(1)} per 100 words)` : "",
            capsRate > 3 ? `${capsRate.toFixed(0)}% ALL-CAPS words` : "",
          ]
            .filter(Boolean)
            .join("; ")}. Replace them with specific, verifiable claims.`,
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
    label: "Privacy policy & terms linked",
    status: hasPrivacy && hasTerms ? "pass" : hasPrivacy || hasTerms ? "warn" : "fail",
    detail:
      hasPrivacy && hasTerms
        ? "Privacy policy and terms/conditions are linked. Required for GDPR, ad platforms and payment processors."
        : `Missing ${[!hasPrivacy && "privacy policy", !hasTerms && "terms & conditions / refund policy"].filter(Boolean).join(" and ")} link. Meta/Google ads and Stripe expect these, and so does GDPR when you collect emails.`,
    weight: 2,
    standard: STANDARDS.euConsumer,
  });

  const businessId = firstMatch(bodyText, BUSINESS_ID);
  const hasContact = /mailto:|tel:/i.test(html) || /[\w.+-]+@[\w-]+\.[\w.]+/.test(bodyText);
  const needsVat = ctx.language.code === "it";
  findings.push({
    id: "business-identity",
    label: "Real business identity & contact",
    status: hasContact && (!needsVat || businessId) ? "pass" : hasContact || businessId ? "warn" : "fail",
    detail:
      hasContact && (!needsVat || businessId)
        ? `A way to contact the coach${businessId ? ` and business ID ("${businessId}")` : ""} is shown. It tells buyers a real, accountable business is behind the offer.`
        : needsVat && !businessId
        ? `No Partita IVA found${hasContact ? "" : " and no email/phone"}. Italian law requires the VAT number on business websites, and it's a basic trust signal.`
        : "No email, phone or contact link found. Buyers of a high-trust service need to know how to reach a real person.",
    weight: 1,
    standard: STANDARDS.euConsumer,
  });

  return category(
    "trust",
    "Trust & Proof",
    "Social proof, coach authority and compliance: result-specific testimonials, video proof, credentials, earnings disclaimers (FTC) and legal pages.",
    findings
  );
}
