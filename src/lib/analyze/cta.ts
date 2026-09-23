import { CheerioDoc } from "./dom";

// English-only matching false-negatives on any non-English page (e.g. an Italian
// page with "Riserva il tuo posto" / "Acquista" / "Paga ora" buttons was reported
// as having no CTA at all). Extended with the languages most likely to show up;
// still not exhaustive for every language a tested page might use.
export const CTA_PATTERN =
  /\b(buy|get|start|sign up|signup|try|book|schedule|contact|download|subscribe|order|shop|join|request|learn more|claim|register|demo|call|apply|reserve|rsvp|secure|enroll|attend|grab|unlock|redeem|watch|enroll|enrol|apply|candidati|candidatura|voglio|riserva|prenota|acquista|paga|iscriviti|iscrizione|partecipa|scopri|richiedi|contattaci|continua|invia|conferma|registrati|reservar|comprar|regístrate|inscríbete|solicita|continuar|más información|contáctanos|réserver|achetez|acheter|inscrivez-vous|inscription|demander|continuer|en savoir plus|contactez-nous|reservieren|jetzt kaufen|anmelden|weiter|mehr erfahren|kontaktieren|inscreva-se|saiba mais|contate-nos)\b/i;

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
