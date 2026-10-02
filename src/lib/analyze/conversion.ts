import { countLeadCaptureFields } from "./cta";
import { CoachingContext, category, isCta } from "./coaching/context";
import {
  CHAT_CHANNEL,
  CHECKOUT_OR_BOOKING,
  PLATFORM_SIGNATURES,
  TRACKING_SIGNATURES,
} from "./coaching/patterns";
import { STANDARDS } from "./coaching/standards";
import { CategoryResult, Finding, tr } from "./types";

/**
 * Technical conversion mechanics: can the visitor act quickly, on mobile, on a
 * fast page, through a working checkout/booking flow — and can the coach
 * measure it? Persuasion elements (proof, guarantee, urgency) are scored in
 * the coaching-specific categories instead.
 */
export function analyzeConversion(
  ctx: CoachingContext,
  htmlSizeBytes: number,
  fetchMs: number,
  isLocal = false
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
    label: tr("Above-the-fold call-to-action", "Call to action above the fold"),
    status: firstCtaIndex === -1 ? "fail" : ctaFoldRatio <= 0.3 ? "pass" : "warn",
    detail:
      firstCtaIndex === -1
        ? tr("Couldn't find a clear CTA button/link on the page.", "Nessun pulsante/link di CTA chiaro nella pagina.")
        : ctaFoldRatio <= 0.3
        ? tr("A call-to-action appears early in the page, likely in the hero.", "Una call to action compare presto, probabilmente già nell'apertura.")
        : tr(
            "The first call-to-action appears fairly deep in the page. Put a CTA (or a \"see the program ↓\" anchor) in the hero.",
            "La prima call to action compare piuttosto in basso. Metti una CTA (o un link \"scopri il programma ↓\") nell'apertura."
          ),
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
    label: tr("Working checkout / booking / application path", "Percorso di acquisto / prenotazione / candidatura funzionante"),
    status: checkoutLinks > 0 || hasConversionPath ? "pass" : "fail",
    detail:
      checkoutLinks > 0
        ? tr(
            `${checkoutLinks} link(s)/embed(s) go straight to a checkout, booking or application tool, so there's no dead end between intent and payment.`,
            `${checkoutLinks} link/elementi incorporati portano direttamente a un checkout, a una prenotazione o a una candidatura: nessun vicolo cieco tra intenzione e pagamento.`
          )
        : hasConversionPath
        ? tr(
            `Found ${formCount > 0 ? `${formCount} form(s)` : `${looseLeadFields} input field(s)`} and ${ctx.ctaTexts.length} CTA element(s). Make sure each CTA lands on checkout/booking in one click.`,
            `Trovati ${formCount > 0 ? `${formCount} form` : `${looseLeadFields} campi di input`} e ${ctx.ctaTexts.length} CTA. Assicurati che ogni CTA porti al checkout/prenotazione con un clic.`
          )
        : tr(
            "No form, CTA or checkout/booking link found. There's no obvious way to buy or apply.",
            "Nessun form, CTA o link di checkout/prenotazione. Non c'è un modo evidente per acquistare o candidarsi."
          ),
    weight: 3,
    standard: STANDARDS.cro,
  });

  const viewport = $('meta[name="viewport"]').attr("content");
  findings.push({
    id: "mobile-ux",
    label: tr("Mobile experience readiness", "Esperienza mobile"),
    status: viewport ? "pass" : "fail",
    detail: viewport
      ? tr(
          "Responsive viewport tag present. Most coaching traffic from Instagram/TikTok/Meta ads is mobile.",
          "Tag viewport responsive presente. La maggior parte del traffico di coaching da Instagram/TikTok/Meta Ads arriva da mobile."
        )
      : tr(
          "No responsive viewport meta tag. Social-ad traffic (mostly mobile) will see a broken layout.",
          "Manca il meta tag viewport responsive. Il traffico dalle inserzioni social (quasi tutto mobile) vedrà un layout rotto."
        ),
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
    label: tr("Estimated page weight & speed", "Peso e velocità stimati della pagina"),
    // A local dev server's response time says nothing about the deployed page.
    status:
      sizeKb <= 300 && (isLocal || fetchMs <= 1500) && scriptCount <= 25
        ? "pass"
        : sizeKb <= 800 && (isLocal || fetchMs <= 3000)
        ? "warn"
        : "fail",
    detail: tr(
      `HTML is ${sizeKb.toFixed(0)}KB with ${scriptCount} scripts, ${stylesheetCount} stylesheets and ${imageCount} images (${lazyImages} lazy-loaded); ${isLocal ? "response time not judged for a local page" : `server responded in ${fetchMs}ms`}. Long sales pages from builders get heavy fast, and every extra second of load costs conversions.`,
      `L'HTML pesa ${sizeKb.toFixed(0)}KB con ${scriptCount} script, ${stylesheetCount} fogli di stile e ${imageCount} immagini (${lazyImages} con caricamento differito); ${isLocal ? "tempo di risposta non valutato per una pagina locale" : `il server ha risposto in ${fetchMs}ms`}. Le pagine di vendita lunghe fatte con i page builder si appesantiscono in fretta, e ogni secondo di caricamento in più costa conversioni.`
    ),
    weight: 2,
    standard: STANDARDS.cwv,
  });

  const trackers = TRACKING_SIGNATURES.filter((t) => t.re.test(html)).map((t) => t.name);
  const adPixel = trackers.some((t) => /Meta|TikTok|LinkedIn/.test(t));
  findings.push({
    id: "tracking",
    label: tr("Conversion tracking installed", "Tracciamento delle conversioni installato"),
    status: trackers.length === 0 ? "warn" : "pass",
    detail:
      trackers.length === 0
        ? tr(
            "No analytics or ad pixel detected (GA4, GTM, Meta Pixel…). Without tracking you can't measure sales-page conversion or retarget visitors who didn't buy. (Tags injected only after cookie consent won't be visible here.)",
            "Nessun analytics o pixel pubblicitario rilevato (GA4, GTM, Meta Pixel…). Senza tracciamento non puoi misurare le conversioni né fare retargeting su chi non ha comprato. (I tag caricati solo dopo il consenso ai cookie qui non sono visibili.)"
          )
        : tr(
            `Detected: ${trackers.join(", ")}.${adPixel ? "" : " No ad pixel found; add Meta/TikTok pixels if you run or plan to run paid traffic and retargeting."}`,
            `Rilevati: ${trackers.join(", ")}.${adPixel ? "" : " Nessun pixel pubblicitario: aggiungi i pixel Meta/TikTok se fai o farai traffico a pagamento e retargeting."}`
          ),
    weight: 1,
    standard: STANDARDS.cro,
  });

  const hasChat = CHAT_CHANNEL.test(html);
  findings.push({
    id: "chat",
    label: tr("Quick-question channel (chat / WhatsApp / DM)", "Canale per domande veloci (chat / WhatsApp / DM)"),
    status: hasChat ? "pass" : "info",
    detail: hasChat
      ? tr(
          "A chat, WhatsApp or DM link lets hesitant buyers ask a question before purchasing, a proven lift for higher-priced programs.",
          "Un link a chat, WhatsApp o DM permette a chi è indeciso di fare una domanda prima di comprare: un aiuto comprovato per i programmi più costosi."
        )
      : tr(
          "No chat/WhatsApp/DM link. Optional, but a \"Questions? Message us\" link rescues buyers who have one last objection.",
          "Nessun link a chat/WhatsApp/DM. Facoltativo, ma un \"Hai domande? Scrivici\" recupera chi ha un'ultima obiezione."
        ),
    weight: 1,
    standard: STANDARDS.cro,
  });

  const platforms = PLATFORM_SIGNATURES.filter((p) => p.re.test(html)).map((p) => p.name);
  if (platforms.length > 0) {
    findings.push({
      id: "platform",
      label: tr("Detected tech stack", "Tecnologie rilevate"),
      status: "info",
      detail: tr(`Built with / integrates: ${platforms.join(", ")}.`, `Realizzata con / integra: ${platforms.join(", ")}.`),
      weight: 0,
    });
  }

  return category(
    "conversion",
    tr("Conversion UX", "UX di conversione"),
    tr(
      "Technical conversion mechanics: above-the-fold CTA, one-click checkout/booking, mobile, speed, tracking and support channel.",
      "Meccanica tecnica della conversione: CTA above the fold, checkout/prenotazione in un clic, mobile, velocità, tracciamento e canale di supporto."
    ),
    findings
  );
}
