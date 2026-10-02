import { CheerioDoc } from "./dom";

// English-only matching false-negatives on any non-English page (e.g. an Italian
// page with "Riserva il tuo posto" / "Acquista" / "Paga ora" buttons was reported
// as having no CTA at all). Extended with the languages most likely to show up;
// still not exhaustive for every language a tested page might use.
export const CTA_PATTERN =
  /\b(buy|get|start|sign up|signup|try|book|schedule|contact|download|subscribe|order|shop|join|request|learn more|claim|register|demo|call|apply|reserve|rsvp|secure|enroll|attend|grab|unlock|redeem|watch|riserva|prenota|acquista|paga|iscriviti|iscrizione|partecipa|scopri|richiedi|contattaci|continua|invia|conferma|registrati|prendi|ottieni|scarica|inizia|scegli|reservar|comprar|regístrate|inscríbete|solicita|continuar|más información|contáctanos|réserver|achetez|acheter|inscrivez-vous|inscription|demander|continuer|en savoir plus|contactez-nous|reservieren|jetzt kaufen|anmelden|weiter|mehr erfahren|kontaktieren|inscreva-se|saiba mais|contate-nos)\b/i;

const NON_LEAD_FIELD_TYPES = new Set(["hidden", "submit", "button"]);

/**
 * Many landing page builders (Systeme.io, ClickFunnels, custom React forms)
 * render lead-capture inputs without a wrapping <form> element. Counting
 * only $("form") misses these entirely, so scan for loose input/select/
 * textarea fields too.
 */
export function countLeadCaptureFields($: CheerioDoc, scope: ReturnType<CheerioDoc>): number {
  return scope
    .find("input, select, textarea")
    .filter((_, f) => {
      const type = ($(f).attr("type") ?? "text").toLowerCase();
      return !NON_LEAD_FIELD_TYPES.has(type);
    })
    .toArray().length;
}

// Things that look like buttons but aren't asks: banner dismissals, menu toggles.
const NON_CTA_TEXT = /^(accept|accetta|accetto|rifiuta|decline|reject|deny|close|chiudi|cancel|annulla|ok|got it|dismiss|no thanks|menu|search|cerca)\b/i;
const NON_CTA_CONTAINER = '[class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"], [class*="gdpr"], [id*="gdpr"]';
// Button-looking classes: "btn", "hds-button", "cta", or Tailwind-style
// background + padding on a link/button (e.g. "rounded-full bg-amber px-8 py-4").
const BUTTON_CLASS = /(^|[\s_-])(btn|button|cta)([\s_-]|$)/i;

type Node$ = ReturnType<CheerioDoc>;

export function ctaLabel($el: Node$): string {
  const tag = String($el.prop("tagName") ?? "").toLowerCase();
  const raw = tag === "input" ? $el.attr("value") ?? "" : $el.text();
  return raw.replace(/\s+/g, " ").trim();
}

function linksToForm($: CheerioDoc, href: string): boolean {
  if (!href.startsWith("#") || href.length < 2) return false;
  const target = $(`[id="${href.slice(1).replace(/"/g, '\\"')}"]`).first();
  return target.length > 0 && (target.is("form") || target.find("form, input, textarea, select").length > 0);
}

export type CtaKind = "action" | "styled";

/**
 * Classifies an <a>/<button>/<input> by what it DOES, not by its wording —
 * "I'm in!", "Count me in", "Let's go" are all CTAs, and no keyword list will
 * ever cover how people phrase an opt-in.
 *
 *  - "action": a real conversion ask — a form submit, a link that jumps to a
 *    form on the page, or CTA wording ("Buy", "Reserve", "Sign up"...).
 *  - "styled": merely button-looking (class/role) — "Sign in", "Add to
 *    calendar", "Back". Enough to show the page has CTAs, but not to count
 *    as a competing ask.
 *  - null: not a CTA. Accordion toggles, banner dismissals and carousel
 *    arrows never count, whatever words they contain.
 */
export function ctaKind($: CheerioDoc, $el: Node$): CtaKind | null {
  const tag = String($el.prop("tagName") ?? "").toLowerCase();
  const text = ctaLabel($el);
  if (text.length < 2 || text.length >= 40 || !/\p{L}/u.test(text)) return null;
  if ($el.attr("aria-expanded") !== undefined || $el.attr("aria-haspopup")) return null;
  if (/[?+−]$/.test(text) || NON_CTA_TEXT.test(text)) return null;
  if ($el.closest(NON_CTA_CONTAINER).length > 0) return null;

  if (CTA_PATTERN.test(text)) return "action";
  if (tag === "input") {
    return ["submit", "button"].includes(($el.attr("type") ?? "").toLowerCase()) ? "action" : null;
  }
  if (tag === "button") {
    const type = ($el.attr("type") ?? "").toLowerCase();
    if (type === "submit" || (type === "" && $el.closest("form").length > 0)) return "action";
  }
  if (tag === "a" && linksToForm($, $el.attr("href") ?? "")) return "action";
  const cls = $el.attr("class") ?? "";
  if (/submit/i.test(cls)) return "action";
  if ($el.attr("role") === "button") return "styled";
  if (BUTTON_CLASS.test(cls)) return "styled";
  return /\bbg-\S+/.test(cls) && /\bpx-\S+/.test(cls) && /\bpy-\S+/.test(cls) ? "styled" : null;
}

export function isCtaElement($: CheerioDoc, $el: Node$): boolean {
  return ctaKind($, $el) !== null;
}

export const CTA_SELECTOR = 'a, button, input[type="submit"], input[type="button"]';

/** `onlyActions` keeps just real conversion asks, excluding button-styled extras. */
export function findCtaElements($: CheerioDoc, onlyActions = false) {
  return $(CTA_SELECTOR).filter((_, el) => {
    const kind = ctaKind($, $(el));
    return onlyActions ? kind === "action" : kind !== null;
  });
}
