import { countLeadCaptureFields } from "./cta";
import { CoachingContext, category, isCta } from "./coaching/context";
import {
  CHAT_CHANNEL,
  CHECKOUT_OR_BOOKING,
  PLATFORM_SIGNATURES,
  TRACKING_SIGNATURES,
} from "./coaching/patterns";
import { STANDARDS } from "./coaching/standards";
import { CategoryResult, Finding } from "./types";

/**
 * Technical conversion mechanics: can the visitor act quickly, on mobile, on a
 * fast page, through a working checkout/booking flow — and can the coach
 * measure it? Persuasion elements (proof, guarantee, urgency) are scored in
 * the coaching-specific categories instead.
 */
export function analyzeConversion(
  ctx: CoachingContext,
  htmlSizeBytes: number,
  fetchMs: number
): CategoryResult {
  const { $, html } = ctx;
  const findings: Finding[] = [];

  const bodyChildren = $("body").find("*");
  const totalNodes = bodyChildren.length || 1;
  let firstCtaIndex = -1;
  bodyChildren.each((i, el) => {
    if (firstCtaIndex !== -1) return;
    const tag = el.tagName?.toLowerCase();
    if (tag === "a" || tag === "button") {
      if (isCta($(el).text().replace(/\s+/g, " ").trim())) firstCtaIndex = i;
    }
  });
  const ctaFoldRatio = firstCtaIndex === -1 ? 1 : firstCtaIndex / totalNodes;
  findings.push({
    id: "above-fold-cta",
    label: "Above-the-fold call-to-action",
    status: firstCtaIndex === -1 ? "fail" : ctaFoldRatio <= 0.3 ? "pass" : "warn",
    detail:
      firstCtaIndex === -1
        ? "Couldn't find a clear CTA button/link on the page."
        : ctaFoldRatio <= 0.3
        ? "A call-to-action appears early in the page, likely in the hero."
        : "The first call-to-action appears fairly deep in the page. Put a CTA (or a \"see the program ↓\" anchor) in the hero.",
    weight: 3,
    standard: STANDARDS.cro,
  });

  const formCount = $("form").length;
  const looseLeadFields = formCount === 0 ? countLeadCaptureFields($, $.root()) : 0;
  const checkoutLinks = $("a[href], form[action], iframe[src]").filter((_, el) =>
    CHECKOUT_OR_BOOKING.test($(el).attr("href") ?? $(el).attr("action") ?? $(el).attr("src") ?? "")
  ).length;
  const hasConversionPath = formCount > 0 || looseLeadFields > 0 || ctx.ctaTexts.length > 0;
  findings.push({
    id: "conversion-path",
    label: "Working checkout / booking / application path",
    status: checkoutLinks > 0 || hasConversionPath ? "pass" : "fail",
    detail:
      checkoutLinks > 0
        ? `${checkoutLinks} link(s)/embed(s) go straight to a checkout, booking or application tool, so there's no dead end between intent and payment.`
        : hasConversionPath
        ? `Found ${formCount > 0 ? `${formCount} form(s)` : `${looseLeadFields} input field(s)`} and ${ctx.ctaTexts.length} CTA element(s). Make sure each CTA lands on checkout/booking in one click.`
        : "No form, CTA or checkout/booking link found. There's no obvious way to buy or apply.",
    weight: 3,
    standard: STANDARDS.cro,
  });

  const viewport = $('meta[name="viewport"]').attr("content");
  findings.push({
    id: "mobile-ux",
    label: "Mobile experience readiness",
    status: viewport ? "pass" : "fail",
    detail: viewport
      ? "Responsive viewport tag present. Most coaching traffic from Instagram/TikTok/Meta ads is mobile."
      : "No responsive viewport meta tag. Social-ad traffic (mostly mobile) will see a broken layout.",
    weight: 2,
    standard: STANDARDS.cwv,
  });

  const scriptCount = $("script[src]").length;
  const stylesheetCount = $('link[rel="stylesheet"]').length;
  const imageCount = $("img").length;
  const lazyImages = $('img[loading="lazy"]').length;
  const sizeKb = htmlSizeBytes / 1024;
  findings.push({
    id: "page-weight",
    label: "Estimated page weight & speed",
    status: sizeKb <= 300 && fetchMs <= 1500 && scriptCount <= 25 ? "pass" : sizeKb <= 800 && fetchMs <= 3000 ? "warn" : "fail",
    detail: `HTML is ${sizeKb.toFixed(0)}KB with ${scriptCount} scripts, ${stylesheetCount} stylesheets and ${imageCount} images (${lazyImages} lazy-loaded); server responded in ${fetchMs}ms. Long sales pages from builders get heavy fast, and every extra second of load costs conversions.`,
    weight: 2,
    standard: STANDARDS.cwv,
  });

  const trackers = TRACKING_SIGNATURES.filter((t) => t.re.test(html)).map((t) => t.name);
  const adPixel = trackers.some((t) => /Meta|TikTok|LinkedIn/.test(t));
  findings.push({
    id: "tracking",
    label: "Conversion tracking installed",
    status: trackers.length === 0 ? "warn" : "pass",
    detail:
      trackers.length === 0
        ? "No analytics or ad pixel detected (GA4, GTM, Meta Pixel…). Without tracking you can't measure sales-page conversion or retarget visitors who didn't buy. (Tags injected only after cookie consent won't be visible here.)"
        : `Detected: ${trackers.join(", ")}.${adPixel ? "" : " No ad pixel found; add Meta/TikTok pixels if you run or plan to run paid traffic and retargeting."}`,
    weight: 1,
    standard: STANDARDS.cro,
  });

  const hasChat = CHAT_CHANNEL.test(html);
  findings.push({
    id: "chat",
    label: "Quick-question channel (chat / WhatsApp / DM)",
    status: hasChat ? "pass" : "info",
    detail: hasChat
      ? "A chat, WhatsApp or DM link lets hesitant buyers ask a question before purchasing, a proven lift for higher-priced programs."
      : "No chat/WhatsApp/DM link. Optional, but a \"Questions? Message us\" link rescues buyers who have one last objection.",
    weight: 1,
    standard: STANDARDS.cro,
  });

  const platforms = PLATFORM_SIGNATURES.filter((p) => p.re.test(html)).map((p) => p.name);
  if (platforms.length > 0) {
    findings.push({
      id: "platform",
      label: "Detected tech stack",
      status: "info",
      detail: `Built with / integrates: ${platforms.join(", ")}.`,
      weight: 0,
    });
  }

  return category(
    "conversion",
    "Conversion UX",
    "Technical conversion mechanics: above-the-fold CTA, one-click checkout/booking, mobile, speed, tracking and support channel.",
    findings
  );
}
