import { CheerioDoc, absoluteUrl, getVisibleText, loadHtml } from "../dom";
import { fetchPage } from "../fetchPage";
import { splitWords } from "../textUtils";
import { CategoryResult, Finding, FunnelInfo, FunnelMode, FunnelStep, FunnelType, LocalizedText, tr } from "../types";
import { CoachingContext, category, firstMatch, isCta } from "./context";
import { APPLICATION_FUNNEL, OUTCOME, PRICE, RESULT_LANGUAGE, distinctMatches, phrases } from "./patterns";
import { STANDARDS } from "./standards";

// ---- Destination classification ---------------------------------------------

const SCHEDULER =
  /calendly\.com|(?:^|\/\/|\.)cal\.com|tidycal\.com|acuityscheduling|youcanbook\.me|savvycal|zcal\.co|oncehub|chilipiper|meetings\.hubspot|hubspot\.com\/meetings|leadconnectorhq\.com\/widget\/booking|\/widget\/booking|koalendar|setmore|simplybook|zoho\.[a-z.]+\/bookings|calendar\.app\.google|calendar\.google\.com\/calendar\/appointments/i;
const FORM_TOOL =
  /typeform\.com|tally\.so|jotform|forms\.gle|docs\.google\.com\/forms|heyflow|involve\.me|scoreapp|fillout\.com|paperform|leadconnectorhq\.com\/widget\/(?:form|survey)|hsforms/i;
const CHECKOUT =
  /checkout\.stripe|buy\.stripe|samcart|thrivecart|kajabi\.com\/offers|\/offers\/[\w-]+\/checkout|paypal\.com\/(?:checkout|cgi|paypalme)|gumroad\.com|payhip|lemonsqueezy|\/checkout(?:\/|$|\?)|\/cart(?:\/|$|\?)|\/order-form/i;
const CONTACT = /^(?:mailto:|tel:)|wa\.me\/|api\.whatsapp\.com|m\.me\//i;
const BUY_WORDS = phrases("buy", "purchase", "add to cart", "checkout", "get instant access", "acquista", "compra", "aggiungi al carrello", "paga", "comprar", "acheter", "kaufen", "comprar agora");
const CALL_WORDS = phrases(
  "call", "calls", "session", "consultation", "chat", "meeting", "appointment", "demo", "talk to", "speak (?:with|to)",
  "chiamata", "sessione", "consulenza", "colloquio", "appuntamento", "videochiamata", "llamada", "sesión", "appel", "gespräch", "chamada", "sessão"
);

type DestinationKind = "anchor" | "scheduler" | "form" | "checkout" | "contact" | "page";

interface CtaLink {
  text: string;
  href: string;
  kind: DestinationKind;
  /** Inside header/nav/footer/menus: site chrome, not the page's own CTA. */
  inChrome: boolean;
}

const CHROME = 'nav, header, footer, [role="navigation"], [class*="menu" i], [class*="navbar" i], [class*="footer" i]';

function classify(href: string, pageUrl: string): DestinationKind {
  if (CONTACT.test(href)) return "contact";
  if (SCHEDULER.test(href)) return "scheduler";
  if (FORM_TOOL.test(href)) return "form";
  if (CHECKOUT.test(href)) return "checkout";
  try {
    const u = new URL(href);
    const p = new URL(pageUrl);
    if (u.hash && u.origin === p.origin && u.pathname === p.pathname) return "anchor";
  } catch {
    // unresolvable href — treat as a page
  }
  return "page";
}

function ctaLinks($: CheerioDoc, pageUrl: string): CtaLink[] {
  return $("a[href]")
    .map((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      const raw = $(el).attr("href") ?? "";
      if (!isCta(text) || raw.startsWith("javascript:")) return null;
      const href = raw.startsWith("#") ? `${pageUrl.split("#")[0]}${raw}` : absoluteUrl(raw, pageUrl) ?? raw;
      return { text, href, kind: classify(href, pageUrl), inChrome: $(el).closest(CHROME).length > 0 };
    })
    .get()
    .filter((c): c is CtaLink => c !== null);
}

// ---- Funnel type ------------------------------------------------------------

export interface FunnelDetection {
  type: FunnelType;
  reason: LocalizedText;
  ctas: CtaLink[];
}

const FREE_CALL_OFFER = phrases(
  "free (?:\\d+[- ]minute )?(?:\\w+ )?(?:call|session|consultation)", "complimentary (?:\\w+ )?(?:call|session|consultation)",
  "(?:call|sessione|consulenza|chiamata)(?: \\w+)? gratuita", "(?:sesión|llamada) gratuita", "appel gratuit", "kostenlose[sn]? (?:gespräch|beratung)"
);

function isCallCta(text: string): boolean {
  return CALL_WORDS.test(text) || APPLICATION_FUNNEL.test(text);
}

export function detectFunnel(ctx: CoachingContext, mode: FunnelMode): FunnelDetection {
  const ctas = ctaLinks(ctx.$, ctx.finalUrl);
  // Buttons count too: many booking CTAs open a pop-up form instead of linking.
  const callCtas = ctx.ctaTexts.filter(isCallCta).length + ctas.filter((c) => c.kind === "scheduler" && !isCallCta(c.text)).length;
  const buyCtas = ctx.ctaTexts.filter((t) => BUY_WORDS.test(t)).length + ctas.filter((c) => c.kind === "checkout" && !BUY_WORDS.test(c.text)).length;
  const embeddedScheduler = SCHEDULER.test(ctx.$("iframe[src], [data-url], .calendly-inline-widget").toString());
  const freeCallOffer = firstMatch(ctx.bodyText, FREE_CALL_OFFER);

  if (mode !== "auto") {
    return {
      type: mode,
      reason: mode === "call" ? tr("Set to free-call funnel.", "Impostato su funnel a call gratuita.") : tr("Set to direct-purchase funnel.", "Impostato su funnel di acquisto diretto."),
      ctas,
    };
  }
  const callScore = callCtas + (embeddedScheduler ? 3 : 0) + (freeCallOffer ? 2 : 0);
  const buyScore = buyCtas + (PRICE.test(ctx.bodyText) ? 1 : 0);
  if (callScore > buyScore) {
    return {
      type: "call",
      reason: tr(
        `${callCtas} CTA(s) invite visitors to a call/application${embeddedScheduler ? ", a booking calendar is embedded" : ""}${
          freeCallOffer ? `, the page offers "${freeCallOffer}"` : ""
        }; ${buyCtas} direct-purchase CTA(s).`,
        `${callCtas} CTA invitano a una call/candidatura${embeddedScheduler ? ", c'è un calendario di prenotazione incorporato" : ""}${
          freeCallOffer ? `, la pagina offre "${freeCallOffer}"` : ""
        }; ${buyCtas} CTA di acquisto diretto.`
      ),
      ctas,
    };
  }
  return {
    type: "checkout",
    reason:
      buyScore > 0
        ? tr(
            `${buyCtas} purchase CTA(s)${PRICE.test(ctx.bodyText) ? " and a visible price" : ""}, vs. ${callCtas} call CTA(s).`,
            `${buyCtas} CTA di acquisto${PRICE.test(ctx.bodyText) ? " e un prezzo visibile" : ""}, contro ${callCtas} CTA per una call.`
          )
        : tr(
            "No call or checkout CTAs detected; defaulting to a direct-purchase page.",
            "Nessuna CTA per call o acquisto: la pagina è trattata come acquisto diretto."
          ),
    ctas,
  };
}

// ---- Booking step resolution -------------------------------------------------

export interface BookingStep {
  steps: FunnelStep[];
  /** HTML of the step where the visitor books/applies, when it's inspectable. */
  $step?: CheerioDoc;
  scopeHtml?: string;
  stepUrl?: string;
  /** Clicks from the landing page's CTA to seeing the booking form/calendar. */
  clicks: number | null;
  kind: FunnelStep["kind"];
}

function hasBookingWidget(html: string): boolean {
  return SCHEDULER.test(html) || FORM_TOOL.test(html) || /<form\b|<input\b(?![^>]*type=["']?hidden)/i.test(html);
}

function mostCommonDestination(ctas: CtaLink[], type: FunnelType): CtaLink | undefined {
  const usable = ctas.filter((c) => c.kind !== "contact");
  const fitsFunnel = (c: CtaLink) =>
    type === "call" ? c.kind === "scheduler" || c.kind === "form" || isCallCta(c.text) : c.kind === "checkout" || !isCallCta(c.text);
  // Prefer the page's own CTAs that match the funnel over menu/footer links.
  const tiers = [usable.filter((c) => !c.inChrome && fitsFunnel(c)), usable.filter(fitsFunnel), usable.filter((c) => !c.inChrome)];
  const relevant = tiers.find((t) => t.length > 0) ?? [];
  const byUrl = new Map<string, { link: CtaLink; count: number }>();
  for (const c of relevant) {
    const key = c.kind === "anchor" ? c.href : c.href.split("#")[0].split("?")[0];
    const entry = byUrl.get(key);
    if (entry) entry.count += 1;
    else byUrl.set(key, { link: c, count: 1 });
  }
  const ranked = Array.from(byUrl.values()).sort((a, b) => {
    // Prefer a real destination over an in-page jump when counts tie.
    if (b.count !== a.count) return b.count - a.count;
    return (a.link.kind === "anchor" ? 1 : 0) - (b.link.kind === "anchor" ? 1 : 0);
  });
  return ranked[0]?.link;
}

const EMBED_LABEL = tr("Booking widget (on page)", "Widget di prenotazione (nella pagina)");
const CALENDAR_LABEL = tr("Booking calendar", "Calendario di prenotazione");
const CHECKOUT_LABEL = tr("Checkout", "Checkout");

function hostedOn(url: string): LocalizedText {
  return tr(`Hosted on ${describeTool(url)}`, `Ospitato su ${describeTool(url)}`);
}

function describeTool(url: string): string {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  })();
  return host;
}

export async function resolveNextStep(ctx: CoachingContext, detection: FunnelDetection): Promise<BookingStep> {
  const { $ } = ctx;
  const landing: FunnelStep = {
    label: tr("Landing page", "Landing page"),
    url: ctx.finalUrl,
    kind: "page",
    notes: [tr(`${ctx.ctaTexts.length} CTA(s)`, `${ctx.ctaTexts.length} CTA`), tr(`~${ctx.wordCount} words`, `~${ctx.wordCount} parole`)],
  };

  // Booking widget embedded directly on the landing page.
  const embed = $("iframe[src]")
    .map((_, el) => $(el).attr("src") ?? "")
    .get()
    .find((src) => SCHEDULER.test(src) || FORM_TOOL.test(src));
  const target = mostCommonDestination(detection.ctas, detection.type);
  const targetFits = target && (detection.type !== "call" || target.kind === "scheduler" || target.kind === "form" || isCallCta(target.text));

  // Call CTAs that are buttons, not links, open a pop-up form (Tony Robbins'
  // "Schedule your session" opens a HubSpot form in a modal).
  if (detection.type === "call" && !targetFits && !embed && ctx.ctaTexts.some(isCallCta)) {
    const tool = FORM_TOOL.test(ctx.html) || /hubspot/i.test(ctx.html) ? (ctx.html.match(/hubspot|typeform|tally|jotform|leadconnector/i)?.[0] ?? "form") : "form";
    const button = ctx.ctaTexts.find(isCallCta);
    return {
      steps: [
        landing,
        {
          label: tr("Pop-up booking form", "Form di prenotazione in pop-up"),
          kind: "form",
          notes: [
            tr(`Button "${button}" opens a ${tool} pop-up`, `Il pulsante "${button}" apre un pop-up ${tool}`),
            tr("rendered by JavaScript, so it can't be inspected", "generato da JavaScript, quindi non ispezionabile"),
          ],
        },
      ],
      clicks: 1,
      kind: "form",
    };
  }

  if (!target) {
    if (embed) {
      return {
        steps: [landing, { label: EMBED_LABEL, url: embed, kind: "embedded", notes: [describeTool(embed)] }],
        $step: $,
        scopeHtml: ctx.html,
        stepUrl: ctx.finalUrl,
        clicks: 0,
        kind: "embedded",
      };
    }
    // No link to follow, but the booking/application form is right on the page.
    if (hasBookingWidget(ctx.$("body").html() ?? "")) {
      return {
        steps: [landing, { label: tr("Booking form (on page)", "Form di prenotazione (nella pagina)"), kind: "embedded", notes: [] }],
        $step: $,
        scopeHtml: ctx.html,
        stepUrl: ctx.finalUrl,
        clicks: 0,
        kind: "embedded",
      };
    }
    return {
      steps: [landing, { label: tr("No CTA destination found", "Nessuna destinazione della CTA"), kind: "unknown", notes: [] }],
      clicks: null,
      kind: "unknown",
    };
  }

  if (target.kind === "anchor") {
    const id = decodeURIComponent(target.href.split("#")[1] ?? "");
    // Filter instead of building a selector: ids can contain quotes/brackets.
    const section = $("[id], a[name]")
      .filter((_, el) => id !== "" && ($(el).attr("id") === id || $(el).attr("name") === id))
      .first();
    const sectionHtml = section.length ? $.html(section) : "";
    if (sectionHtml && hasBookingWidget(sectionHtml)) {
      return {
        steps: [
          landing,
          {
            label: tr("Booking form / calendar (same page)", "Form / calendario di prenotazione (stessa pagina)"),
            url: target.href,
            kind: "embedded",
            notes: [tr(`CTA "${target.text}" jumps to #${id}`, `La CTA "${target.text}" porta a #${id}`)],
          },
        ],
        $step: loadHtml(sectionHtml),
        scopeHtml: sectionHtml,
        stepUrl: ctx.finalUrl,
        clicks: 0,
        kind: "embedded",
      };
    }
    // The anchor lands on a section that itself links onward — follow that.
    const onward = section.length
      ? ctaLinks(loadHtml(sectionHtml), ctx.finalUrl).find((c) => c.kind !== "anchor" && c.kind !== "contact")
      : undefined;
    if (onward) return followLink(ctx, landing, onward, 1, detection.type);
    if (embed) {
      return {
        steps: [landing, { label: EMBED_LABEL, url: embed, kind: "embedded", notes: [describeTool(embed)] }],
        $step: $,
        scopeHtml: ctx.html,
        stepUrl: ctx.finalUrl,
        clicks: 0,
        kind: "embedded",
      };
    }
    return {
      steps: [
        landing,
        {
          label: tr("In-page jump with no booking form", "Salto interno alla pagina senza form di prenotazione"),
          url: target.href,
          kind: "unknown",
          notes: [`CTA "${target.text}"`],
        },
      ],
      clicks: null,
      kind: "unknown",
    };
  }

  return followLink(ctx, landing, target, 0, detection.type);
}

async function followLink(
  ctx: CoachingContext,
  landing: FunnelStep,
  link: CtaLink,
  extraClicks: number,
  type: FunnelType
): Promise<BookingStep> {
  if (link.kind === "scheduler" || link.kind === "form" || link.kind === "checkout") {
    return {
      steps: [
        landing,
        {
          label: link.kind === "scheduler" ? CALENDAR_LABEL : link.kind === "form" ? tr("Application form", "Form di candidatura") : CHECKOUT_LABEL,
          url: link.href,
          kind: link.kind,
          notes: [`CTA "${link.text}"`, hostedOn(link.href)],
        },
      ],
      stepUrl: link.href,
      clicks: 1 + extraClicks,
      kind: link.kind,
    };
  }

  let page;
  try {
    page = await fetchPage(link.href);
  } catch {
    page = null;
  }
  if (!page || page.status >= 400 || !page.html) {
    return {
      steps: [
        landing,
        {
          label: tr("Next step (unreachable)", "Passo successivo (non raggiungibile)"),
          url: link.href,
          kind: "unknown",
          notes: [page ? `HTTP ${page.status}` : tr("Could not fetch", "Impossibile scaricarla")],
        },
      ],
      stepUrl: link.href,
      clicks: 1 + extraClicks,
      kind: "unknown",
    };
  }

  const $n = loadHtml(page.html);
  const words = splitWords(getVisibleText($n)).length;
  const embedded = $n("iframe[src]")
    .map((_, el) => $n(el).attr("src") ?? "")
    .get()
    .find((src) => SCHEDULER.test(src) || FORM_TOOL.test(src));
  const notes: FunnelStep["notes"] = [`CTA "${link.text}"`, tr(`~${words} words`, `~${words} parole`)];
  if (page.finalUrl !== link.href) notes.push(tr(`redirects to ${page.finalUrl}`, `reindirizza a ${page.finalUrl}`));
  if (embedded) notes.push(tr(`embeds ${describeTool(embedded)}`, `incorpora ${describeTool(embedded)}`));
  else if (SCHEDULER.test(page.html)) notes.push(tr("loads a booking-calendar script", "carica uno script di calendario di prenotazione"));
  if (words < 40 && !hasBookingWidget(page.html))
    notes.push(
      tr(
        "content is rendered by JavaScript, so it could only be partly inspected",
        "contenuto generato da JavaScript, quindi ispezionabile solo in parte"
      )
    );

  const label =
    type === "call"
      ? tr("Booking / application page", "Pagina di prenotazione / candidatura")
      : tr("Enrollment / offer page", "Pagina di iscrizione / offerta");
  const steps: FunnelStep[] = [landing, { label, url: page.finalUrl, kind: "page", notes }];
  // A form that leads on to a separate calendar (Jay Shetty, Clients on Demand).
  const onward = ctaLinks($n, page.finalUrl).find((c) => c.kind === "scheduler");
  if (onward) steps.push({ label: CALENDAR_LABEL, url: onward.href, kind: "scheduler", notes: [describeTool(onward.href)] });
  const checkout = type === "checkout" ? ctaLinks($n, page.finalUrl).find((c) => c.kind === "checkout") : undefined;
  if (checkout) steps.push({ label: CHECKOUT_LABEL, url: checkout.href, kind: "checkout", notes: [`CTA "${checkout.text}"`, hostedOn(checkout.href)] });

  return { steps, $step: $n, scopeHtml: page.html, stepUrl: page.finalUrl, clicks: 1 + extraClicks, kind: "page" };
}

// ---- Call-invitation copy (landing page) --------------------------------------

const NAMED_CALL = phrases(
  "breakthrough (?:call|session)", "(?:\\w+ )?strategy (?:call|session)", "clarity (?:call|session)", "discovery (?:call|session)", "assessment call", "demo call",
  "game[- ]plan (?:call|session)", "roadmap (?:call|session)", "success (?:call|session)", "(?:business|career|life) audit", "diagnostic (?:call|session)",
  "sessione strategica", "call strategica", "call conoscitiva", "sessione (?:di|della) chiarezza", "call di (?:chiarezza|orientamento|analisi|valutazione)",
  "consulenza strategica", "sessione di (?:scoperta|orientamento|analisi)", "check[- ]up", "analisi gratuita",
  "sesión estratégica", "appel stratégique", "strategiegespräch", "sessão estratégica"
);
const GENERIC_CALL = phrases("call", "session", "consultation", "chiamata", "sessione", "consulenza", "colloquio", "videochiamata");
const FREE = phrases(
  "free", "complimentary", "no[- ]cost", "at no charge", "on us",
  "gratuit[ao]", "gratis", "senza costi?", "in omaggio", "offerta da noi",
  "gratuita?", "sin costo", "gratuit", "kostenlos", "gratuito"
);
const CALL_LENGTH = phrases("\\d+[- ]?(?:min|mins|minutes?|minuti|minutos)", "(?:half|an?) hour", "mezz'ora", "un'ora");
const CALL_TAKEAWAY = phrases(
  "on (?:this|the|our|your) (?:call|session)", "during (?:the|this|your|our) (?:call|session)", "you(?:'ll| will) (?:leave|walk away|get|receive) with",
  "by the end of (?:the|this|our) (?:call|session)", "(?:we(?:'ll| will)|let's|together we(?:'ll| will)) (?:map|create|build|identify|uncover|design|diagnose|review|figure out)",
  "map out", "action plan", "game plan", "personal (?:path|plan|roadmap)",
  "what (?:happens|to expect) on the call", "you(?:'ll| will) (?:discover|get clarity|leave)",
  "durante la (?:call|sessione|chiamata|consulenza)", "nella (?:call|sessione)", "in questa (?:call|sessione)", "alla fine della (?:call|sessione)",
  "uscirai con", "insieme (?:definiremo|creeremo|analizzeremo|costruiremo|individueremo)", "(?:analizzeremo|definiremo|creeremo|individueremo)",
  "cosa (?:succede|accade) (?:durante|nella) (?:call|sessione)", "otterrai", "riceverai",
  "durante la llamada", "pendant l'appel", "im gespräch", "durante a chamada"
);
const CALL_WHO = phrases(
  "with me", "with (?:one of )?(?:our|my) (?:coaches|team|advisors?|experts?|specialists?|strategists?)", "enrol+ment advisor", "you(?:'ll| will) (?:speak|talk|meet) (?:with|to)",
  "personally", "one[- ]on[- ]one with",
  "con me", "parlerai (?:con|direttamente)", "direttamente con", "con (?:un|uno|una) de(?:i|gli|lle) nostr[ie] (?:coach|consulenti|esperti|specialisti)", "con il (?:mio|nostro) team",
  "personalmente", "conmigo", "avec moi", "mit mir", "comigo"
);
const NO_PRESSURE = phrases(
  "no obligation", "no pressure", "no strings(?: attached)?", "not a sales (?:pitch|call)", "zero pressure", "no hard sell", "no commitment", "without obligation",
  "senza impegno", "nessun obbligo", "nessuna pressione", "non è una (?:call|telefonata) di vendita", "senza vincoli", "zero pressioni", "nessun impegno",
  "sin compromiso", "sans engagement", "unverbindlich", "sem compromisso"
);
const QUALIFICATION = phrases(
  "limited (?:number of )?(?:spots|calls|sessions|slots|places)", "only \\d+ (?:calls|spots|sessions|slots)", "(?:each|per|every) week", "we only (?:accept|work with|take)",
  "application", "apply", "qualify", "not everyone", "spots are limited", "by application only",
  "posti limitati", "solo \\d+ (?:call|sessioni|posti|slot)", "ogni settimana", "a settimana", "candidatura", "candidati", "selezioniamo", "solo su candidatura",
  "numero limitato", "non (?:accettiamo|lavoriamo con) tutti",
  "plazas limitadas", "places limitées", "begrenzte plätze", "vagas limitadas"
);
const HOW_IT_WORKS = phrases(
  "how it works", "how does it work", "step 1", "step one", "\\d steps?", "here's what happens", "the process",
  "come funziona", "passo 1", "fase 1", "\\d (?:semplici )?passi", "ecco cosa succede", "il processo", "step 1",
  "cómo funciona", "comment ça marche", "so funktioniert", "como funciona"
);
const INVESTMENT_ADDRESSED = phrases(
  "how much (?:does|is) (?:it|the (?:program|coaching|certification))(?: cost)?", "what(?:'s| is) the (?:investment|price|cost)", "investment", "pricing",
  "quanto costa", "qual è (?:l'investimento|il prezzo|il costo)", "investimento", "prezzo", "costi",
  "cuánto cuesta", "combien (?:ça )?coûte", "was kostet", "quanto custa"
);

// ---- Booking-step signals -----------------------------------------------------

const BUDGET_Q = phrases(
  "budget", "invest\\w*", "financial situation", "afford", "income", "revenue",
  "disposto a investire", "disponibilità economica", "investimento", "fatturato", "situazione (?:economica|finanziaria)", "capacità di spesa",
  "presupuesto", "invertir", "investir", "investieren"
);
const MULTI_STEP = /step\s*1\s*(?:of|\/|di|de|von)\s*\d|passo\s*1\s*(?:di|\/)\s*\d|\b1\s*\/\s*[2-5]\b|progress-?bar|multi-?step|form-step/i;
const CONSENT = phrases("privacy", "gdpr", "consent", "consenso", "trattamento dei dati", "terms", "termini", "datenschutz", "confidentialité");
const PROOF_SELECTOR = 'blockquote, [class*="testimonial" i], [class*="review" i], [class*="recension" i], [class*="testimonianz" i]';

function formSignals($s: CheerioDoc) {
  const fields = $s("input, select, textarea").filter((_, f) => {
    const type = ($s(f).attr("type") ?? "text").toLowerCase();
    return !["hidden", "submit", "button", "image", "reset"].includes(type);
  });
  const radioGroups = new Set(
    $s('input[type="radio"]')
      .map((_, el) => $s(el).attr("name") ?? "")
      .get()
  ).size;
  const selects = $s("select").length;
  const textareas = $s("textarea").length;
  const questionLabels = $s("label, legend, h3, h4, p, span")
    .map((_, el) => $s(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((t) => t.length > 8 && t.length < 160 && /\?\s*\*?$/.test(t));
  const firstField = fields.first();
  const firstKey = `${firstField.attr("type") ?? ""} ${firstField.attr("name") ?? ""} ${firstField.attr("placeholder") ?? ""} ${firstField.attr("autocomplete") ?? ""}`.toLowerCase();
  const phone = $s('input[type="tel"], input[name*="phone" i], input[name*="telefono" i], input[autocomplete="tel"]').length > 0;
  return {
    fieldCount: fields.length,
    qualifying: Math.max(radioGroups + selects + textareas, new Set(questionLabels).size),
    questionLabels: Array.from(new Set(questionLabels)),
    contactFirst: /mail|name|nome|first|tel|phone/.test(firstKey),
    phone,
  };
}

// ---- Category -------------------------------------------------------------------

/**
 * The free-call funnel the leading coaching businesses run (Tony Robbins
 * Results Coaching, Russ Ruffino's Clients on Demand, Jay Shetty Certification,
 * Sam Ovens' Consulting.com): the page sells the *call*, not the program, and a
 * short, qualifying booking step filters who gets on the calendar.
 */
export function analyzeCallFunnel(ctx: CoachingContext, booking: BookingStep): CategoryResult {
  const { bodyText } = ctx;
  const findings: Finding[] = [];
  const copy = `${ctx.headingText} ${bodyText} ${ctx.ctaTexts.join(" ")}`;

  // --- The call as an offer ---
  const named = firstMatch(copy, NAMED_CALL);
  const generic = firstMatch(copy, GENERIC_CALL);
  findings.push({
    id: "call-named",
    label: tr("The call is named and sold as a valuable session", "La call ha un nome ed è presentata come una sessione di valore"),
    status: named ? "pass" : generic ? "warn" : "fail",
    detail: named
      ? tr(
          `The call has a value-framed name ("${named}"). "Breakthrough Call" and "Strategy Session" sell a result; "a call" sells a sales pitch.`,
          `La call ha un nome che ne comunica il valore ("${named}"). "Sessione Strategica" o "Call di Chiarezza" vendono un risultato; "una call" vende una presentazione commerciale.`
        )
      : generic
      ? tr(
          `The page offers a generic "${generic}". Name it for the result it delivers, like Ruffino's "Breakthrough Call" or Tony Robbins' "Strategy Session".`,
          `La pagina offre una generica "${generic}". Dalle un nome legato al risultato, come la "Breakthrough Call" di Ruffino o la "Strategy Session" di Tony Robbins (es. "Sessione Strategica", "Call di Chiarezza").`
        )
      : tr(
          "The page never clearly offers a call. Say what the next step is and give it a name.",
          "La pagina non offre mai chiaramente una call. Di' qual è il passo successivo e dagli un nome."
        ),
    weight: 2,
    standard: STANDARDS.callFunnel,
  });

  const free = firstMatch(copy, FREE);
  findings.push({
    id: "call-free",
    label: tr("Clearly free", "Chiaramente gratuita"),
    status: free ? "pass" : "fail",
    detail: free
      ? tr(
          `The call is marked as free ("${free}"), which removes the first objection to booking.`,
          `La call è indicata come gratuita ("${free}"): toglie la prima obiezione alla prenotazione.`
        )
      : tr(
          "The page doesn't say the call is free. Visitors assume a hidden cost; put \"free\" in the headline area and on every CTA.",
          "La pagina non dice che la call è gratuita. I visitatori immaginano un costo nascosto: scrivi \"gratuita\" nella zona del titolo e su ogni CTA."
        ),
    weight: 2,
    standard: STANDARDS.callFunnel,
  });

  const length = firstMatch(copy, CALL_LENGTH);
  findings.push({
    id: "call-length",
    label: tr("Call length stated", "Durata della call indicata"),
    status: length ? "pass" : "warn",
    detail: length
      ? tr(
          `The call length is stated ("${length}"). A known, bounded time commitment makes booking feel safe.`,
          `La durata della call è indicata ("${length}"). Un impegno di tempo noto e limitato rende la prenotazione rassicurante.`
        )
      : tr(
          "No call length given. Tony Robbins says \"free 30-minute strategy session\"; state yours.",
          "Nessuna durata indicata. Tony Robbins scrive \"sessione strategica gratuita di 30 minuti\": indica la tua (es. \"call gratuita di 30 minuti\")."
        ),
    weight: 1,
    standard: STANDARDS.callFunnel,
  });

  const takeaway = firstMatch(copy, CALL_TAKEAWAY);
  findings.push({
    id: "call-takeaway",
    label: tr("What they'll get from the call", "Cosa ottengono dalla call"),
    status: takeaway ? "pass" : "fail",
    detail: takeaway
      ? tr(
          `The page tells visitors what the call gives them ("${takeaway}"). The call has to be worth it even if they never buy.`,
          `La pagina dice cosa dà la call ("${takeaway}"). La call deve valere la pena anche per chi poi non compra.`
        )
      : tr(
          "No promise of what happens or what they leave with on the call. Clients on Demand says \"we'll map out a step-by-step plan\". List 3 concrete takeaways (clarity on X, a plan for Y, what's blocking Z).",
          "Nessuna promessa su cosa succede o con cosa si esce dalla call. Clients on Demand scrive \"definiremo un piano passo passo\". Elenca 3 risultati concreti (chiarezza su X, un piano per Y, cosa blocca Z)."
        ),
    weight: 3,
    standard: STANDARDS.callFunnel,
  });

  const who = firstMatch(copy, CALL_WHO);
  findings.push({
    id: "call-who",
    label: tr("Who they'll speak with", "Con chi parleranno"),
    status: who ? "pass" : "warn",
    detail: who
      ? tr(
          `The page says who they'll talk to ("${who}"). Knowing it's the coach (or a named advisor) reduces anxiety about the call.`,
          `La pagina dice con chi parleranno ("${who}"). Sapere che è il coach (o un consulente con nome) riduce l'ansia per la call.`
        )
      : tr(
          "The page doesn't say who takes the call (you personally? a team member?). Say it, ideally with a face.",
          "La pagina non dice chi fa la call (tu personalmente? qualcuno del team?). Dillo, meglio se con una foto."
        ),
    weight: 1,
    standard: STANDARDS.callFunnel,
  });

  const noPressure = firstMatch(copy, NO_PRESSURE);
  findings.push({
    id: "no-pressure",
    label: tr("No-pressure reassurance", "Rassicurazione \"senza pressioni\""),
    status: noPressure ? "pass" : "warn",
    detail: noPressure
      ? tr(`The page defuses sales-call anxiety ("${noPressure}").`, `La pagina smonta l'ansia da call di vendita ("${noPressure}").`)
      : tr(
          "No \"no obligation / not a sales pitch\" reassurance. Fear of being hard-sold is the #1 reason people don't book; one line near the CTA fixes it.",
          "Nessuna rassicurazione \"senza impegno / non è una call di vendita\". La paura di subire una vendita aggressiva è il motivo n. 1 per cui non si prenota: basta una riga vicino alla CTA (\"senza impegno\")."
        ),
    weight: 2,
    standard: STANDARDS.callFunnel,
  });

  const qualification = firstMatch(copy, QUALIFICATION);
  findings.push({
    id: "qualification-scarcity",
    label: tr("Qualification / limited availability", "Selezione / disponibilità limitata"),
    status: qualification ? "pass" : "warn",
    detail: qualification
      ? tr(
          `The page signals the call isn't for everyone ("${qualification}"). Selectivity raises the perceived value of the call and the quality of bookings.`,
          `La pagina fa capire che la call non è per tutti ("${qualification}"). La selettività aumenta il valore percepito della call e la qualità delle prenotazioni.`
        )
      : tr(
          "Anyone can seemingly book. Say who the call is for and that spots are limited (e.g. \"only 5 calls a week\") so booking feels like being selected.",
          "Sembra che chiunque possa prenotare. Di' a chi è rivolta la call e che i posti sono limitati (es. \"solo 5 call a settimana\"), così prenotare sembra essere stati selezionati."
        ),
    weight: 2,
    standard: STANDARDS.cialdini,
  });

  const how = firstMatch(copy, HOW_IT_WORKS);
  findings.push({
    id: "how-it-works",
    label: tr("\"How it works\" steps", "Passaggi \"come funziona\""),
    status: how ? "pass" : "warn",
    detail: how
      ? tr(
          `The path is laid out ("${how}"). Jay Shetty's 4-step journey and StoryBrand's "plan" step both make the next move feel obvious.`,
          `Il percorso è spiegato ("${how}"). Il percorso in 4 passi di Jay Shetty e il "piano" di StoryBrand rendono ovvio il passo successivo.`
        )
      : tr(
          "No simple \"how it works\" (1. Book your free call → 2. We map your plan → 3. You start). A 3-step plan is the StoryBrand standard for reducing confusion.",
          "Manca un semplice \"come funziona\" (1. Prenota la call gratuita → 2. Definiamo il tuo piano → 3. Inizi). Un piano in 3 passi è lo standard StoryBrand per ridurre la confusione."
        ),
    weight: 1,
    standard: STANDARDS.storybrand,
  });

  const investment = firstMatch(copy, INVESTMENT_ADDRESSED);
  findings.push({
    id: "investment-addressed",
    label: tr("Price question addressed (even if not shown)", "Domanda sul prezzo affrontata (anche senza mostrarlo)"),
    status: investment ? "pass" : "warn",
    detail: investment
      ? tr(
          `The page addresses the investment ("${investment}"). Hiding the price is normal here, but ignoring the question isn't.`,
          `La pagina parla dell'investimento ("${investment}"). Nascondere il prezzo qui è normale, ignorare la domanda no.`
        )
      : tr(
          "Nothing about price. Visitors wonder \"how much is this?\"; add an FAQ like Jay Shetty's (\"How much does it cost?\"), explaining the price depends on the plan and is covered on the call, or give a range.",
          "Nulla sul prezzo. I visitatori si chiedono \"quanto costa?\": aggiungi una FAQ come quella di Jay Shetty (\"Quanto costa?\") spiegando che dipende dal piano e se ne parla in call, oppure indica una fascia."
        ),
    weight: 1,
    standard: STANDARDS.callFunnel,
  });

  const callCtas = ctx.ctaTexts.filter((t) => CALL_WORDS.test(t) || APPLICATION_FUNNEL.test(t));
  findings.push({
    id: "cta-names-call",
    label: tr("CTAs name the call", "Le CTA nominano la call"),
    status: callCtas.length >= 2 ? "pass" : callCtas.length === 1 ? "warn" : "fail",
    detail:
      callCtas.length >= 2
        ? tr(
            `${callCtas.length} CTAs explicitly say what happens on click (e.g. "${callCtas[0]}").`,
            `${callCtas.length} CTA dicono esplicitamente cosa succede al clic (es. "${callCtas[0]}").`
          )
        : callCtas.length === 1
        ? tr(
            `Only one CTA mentions the call ("${callCtas[0]}"). Make every button say it: "Book my free call".`,
            `Solo una CTA cita la call ("${callCtas[0]}"). Fallo dire a ogni pulsante: "Prenota la tua call gratuita".`
          )
        : tr(
            "No CTA mentions the call. Generic buttons (\"Learn more\", \"Start\") hide the next step; say \"Book my free strategy call\".",
            "Nessuna CTA cita la call. I pulsanti generici (\"Scopri di più\", \"Inizia\") nascondono il passo successivo: scrivi \"Prenota la mia sessione strategica gratuita\"."
          ),
    weight: 2,
    standard: STANDARDS.cro,
  });

  // --- Booking step ---
  findings.push({
    id: "clicks-to-book",
    label: tr("Clicks from CTA to booking", "Clic dalla CTA alla prenotazione"),
    status: booking.clicks === null ? "fail" : booking.clicks <= 1 ? "pass" : "warn",
    detail:
      booking.clicks === null
        ? tr(
            "Couldn't find where the CTA leads. Every CTA should open the booking form or calendar.",
            "Impossibile capire dove porta la CTA. Ogni CTA dovrebbe aprire il form di prenotazione o il calendario."
          )
        : booking.clicks === 0
        ? tr(
            "The booking form/calendar is embedded on the page itself, so there's zero navigation between decision and booking.",
            "Il form/calendario di prenotazione è incorporato nella pagina: zero navigazione tra decisione e prenotazione."
          )
        : booking.clicks === 1
        ? tr("One click from CTA to the booking/application step. That's the standard.", "Un clic dalla CTA alla prenotazione/candidatura. È lo standard.")
        : tr(
            `${booking.clicks} clicks before the booking step. Every extra page loses people; link CTAs straight to the booking step.`,
            `${booking.clicks} clic prima della prenotazione. Ogni pagina in più fa perdere persone: collega le CTA direttamente alla prenotazione.`
          ),
    weight: 2,
    standard: STANDARDS.cro,
  });

  if (booking.kind === "scheduler" || booking.kind === "form") {
    const where = booking.stepUrl ? describeTool(booking.stepUrl) : null;
    findings.push({
      id: "booking-hosted",
      label: tr("Hosted booking tool", "Strumento di prenotazione esterno"),
      status: booking.kind === "form" ? "pass" : "warn",
      detail:
        booking.kind === "form"
          ? tr(
              `CTAs open a hosted application form (${where ?? "a pop-up on the page"}). Its questions render with JavaScript, so check manually that they qualify budget and commitment.`,
              `Le CTA aprono un form di candidatura esterno (${where ?? "un pop-up nella pagina"}). Le domande sono generate da JavaScript: verifica a mano che qualifichino budget e impegno.`
            )
          : tr(
              `CTAs go straight to a bare scheduler (${where}). That's easy, but there's no qualification and no reassurance on that page. Leaders put the calendar on their own page with a headline, 2-4 qualifying questions and testimonials (Clients on Demand, Tony Robbins /start).`,
              `Le CTA portano direttamente a un calendario nudo (${where}). È comodo, ma su quella pagina non c'è né selezione né rassicurazione. I leader mettono il calendario su una pagina propria con titolo, 2-4 domande di qualificazione e testimonianze (Clients on Demand, Tony Robbins /start).`
            ),
      weight: 2,
      standard: STANDARDS.callFunnel,
    });
  }

  if (booking.$step && booking.scopeHtml) {
    const $s = booking.$step;
    const signals = formSignals($s);
    const stepText = getVisibleText($s);
    const words = splitWords(stepText).length;
    const jsRendered = words < 40 && signals.fieldCount === 0;
    const hasCalendar = SCHEDULER.test(booking.scopeHtml);
    const hasForm = signals.fieldCount > 0 || FORM_TOOL.test(booking.scopeHtml);

    findings.push({
      id: "booking-mechanism",
      label: tr("Booking step has a form and/or calendar", "La prenotazione ha un form e/o un calendario"),
      status: hasCalendar || hasForm ? "pass" : jsRendered ? "info" : "fail",
      detail:
        hasCalendar && hasForm
          ? tr(
              "The booking step has both an application form and a calendar, which is the Clients on Demand / Jay Shetty setup.",
              "La prenotazione ha sia un form di candidatura sia un calendario: è la configurazione di Clients on Demand / Jay Shetty."
            )
          : hasCalendar
          ? tr("A booking calendar is present on the step.", "È presente un calendario di prenotazione.")
          : hasForm
          ? tr(
              `An application form (${signals.fieldCount} fields) is present. Make sure the calendar appears right after submit, while intent is highest.`,
              `È presente un form di candidatura (${signals.fieldCount} campi). Assicurati che il calendario compaia subito dopo l'invio, quando l'intenzione è più alta.`
            )
          : jsRendered
          ? tr(
              "The booking step is rendered entirely by JavaScript, so its form/calendar couldn't be inspected. Check it manually.",
              "La prenotazione è generata interamente da JavaScript, quindi form/calendario non sono ispezionabili. Controllala a mano."
            )
          : tr(
              "The page after the CTA has no form and no calendar. Visitors who clicked \"book\" hit a dead end.",
              "La pagina dopo la CTA non ha né form né calendario. Chi ha cliccato \"prenota\" finisce in un vicolo cieco."
            ),
      weight: jsRendered && !hasCalendar && !hasForm ? 0 : 3,
      standard: STANDARDS.cro,
    });

    if (!jsRendered) {
      const example = signals.questionLabels[0];
      findings.push({
        id: "qualifying-questions",
        label: tr("Qualifying questions before the calendar", "Domande di qualificazione prima del calendario"),
        status: signals.qualifying >= 2 ? "pass" : "warn",
        detail:
          signals.qualifying >= 2
            ? tr(
                `${signals.qualifying} qualifying questions found${example ? ` (e.g. "${example}")` : ""}. Pre-qualifying protects your calendar and raises show-up and close rates.`,
                `${signals.qualifying} domande di qualificazione${example ? ` (es. "${example}")` : ""}. Qualificare prima protegge il calendario e aumenta presenze e chiusure.`
              )
            : tr(
                "Few or no qualifying questions. Ask 2-4 (situation, main goal, urgency, budget) before showing the calendar, like Jay Shetty's \"What best describes your financial situation?\".",
                "Poche o nessuna domanda di qualificazione. Fanne 2-4 (situazione, obiettivo principale, urgenza, budget) prima del calendario, come il \"Cosa descrive meglio la tua situazione finanziaria?\" di Jay Shetty."
              ),
        weight: 2,
        standard: STANDARDS.callFunnel,
        items: signals.questionLabels.length ? signals.questionLabels.slice(0, 8).map((t) => ({ text: t })) : undefined,
      });

      const budget = firstMatch(`${signals.questionLabels.join(" ")} ${stepText}`, BUDGET_Q);
      findings.push({
        id: "budget-question",
        label: tr("Budget / investment readiness asked", "Domanda su budget / disponibilità a investire"),
        status: budget ? "pass" : "warn",
        detail: budget
          ? tr(
              `The booking step checks financial readiness ("${budget}"), so you don't spend calls on people who can't invest.`,
              `La prenotazione verifica la disponibilità economica ("${budget}"), così non sprechi call con chi non può investire.`
            )
          : tr(
              "No budget/investment-readiness question. For a paid program behind a free call, this is the single most useful filter (\"If it's the right fit, are you ready to invest in it?\").",
              "Nessuna domanda su budget/disponibilità a investire. Per un programma a pagamento dietro una call gratuita è il filtro più utile in assoluto (\"Se il percorso è giusto per te, sei pronto a investire?\")."
            ),
        weight: 2,
        standard: STANDARDS.hormozi,
      });

      if (signals.fieldCount > 0) {
        const multiStep = MULTI_STEP.test(booking.scopeHtml);
        const n = signals.fieldCount;
        findings.push({
          id: "form-friction",
          label: tr("Form length & structure", "Lunghezza e struttura del form"),
          status: n <= 10 || multiStep ? (signals.contactFirst ? "pass" : "warn") : "warn",
          detail: tr(
            `${n} field(s)${multiStep ? ", split into steps" : ""}${signals.contactFirst ? ", contact details first" : ""}. ${
              n > 10 && !multiStep
                ? "Long single-page forms scare people off; split into steps (\"Step 1 of 3\") like Jay Shetty."
                : !signals.contactFirst
                ? "Ask for name/email first so you can follow up with people who abandon the form."
                : "Good balance: contact details first (so abandoners can be followed up) and a manageable length."
            }`,
            `${n} campi${multiStep ? ", divisi in passaggi" : ""}${signals.contactFirst ? ", contatti per primi" : ""}. ${
              n > 10 && !multiStep
                ? "I form lunghi su una sola pagina spaventano: dividili in passaggi (\"Passo 1 di 3\") come Jay Shetty."
                : !signals.contactFirst
                ? "Chiedi prima nome/email, così puoi ricontattare chi abbandona il form."
                : "Buon equilibrio: contatti per primi (per ricontattare chi abbandona) e lunghezza gestibile."
            }`
          ),
          weight: 1,
          standard: STANDARDS.cro,
        });
      }

      const hasProof = $s(PROOF_SELECTOR).length > 0 || distinctMatches(stepText, RESULT_LANGUAGE).length >= 2;
      const hasPromise = OUTCOME.test(stepText.slice(0, 600));
      if (booking.kind === "page") {
        findings.push({
          id: "booking-proof",
          label: tr("Proof & promise repeated on the booking step", "Prove e promessa ripetute nella prenotazione"),
          status: hasProof && hasPromise ? "pass" : hasProof || hasPromise ? "warn" : "fail",
          detail:
            hasProof && hasPromise
              ? tr(
                  "The booking page restates the outcome and shows proof, keeping momentum while people fill the form.",
                  "La pagina di prenotazione ribadisce il risultato e mostra prove: mantiene lo slancio mentre le persone compilano il form."
                )
              : tr(
                  "The booking page is missing the outcome headline and/or testimonials. Clients on Demand puts a testimonial wall under its application; restate the promise at the top and add 3-6 results.",
                  "Alla pagina di prenotazione mancano il titolo sul risultato e/o le testimonianze. Clients on Demand mette un muro di testimonianze sotto la candidatura: ribadisci la promessa in alto e aggiungi 3-6 risultati."
                ),
          weight: 2,
          standard: STANDARDS.cialdini,
        });
      }

      if (signals.fieldCount > 0) {
        const consent = CONSENT.test(stepText);
        findings.push({
          id: "form-consent",
          label: tr("Privacy consent on the form", "Consenso privacy nel form"),
          status: consent ? "pass" : "warn",
          detail: consent
            ? tr("The form references privacy/consent (GDPR).", "Il form fa riferimento a privacy/consenso (GDPR).")
            : tr(
                "No privacy/consent notice near the form. Required under GDPR when collecting names, emails and phone numbers.",
                "Nessuna informativa privacy/consenso vicino al form. Obbligatoria per il GDPR quando raccogli nomi, email e numeri di telefono."
              ),
          weight: 1,
          standard: STANDARDS.euConsumer,
        });
      }

      if (signals.phone) {
        findings.push({
          id: "phone-field",
          label: tr("Phone number requested", "Numero di telefono richiesto"),
          status: "info",
          detail: tr(
            "A phone field is present. It lowers submissions slightly but enables SMS/WhatsApp reminders, which strongly improve show-up rates. Jay Shetty asks for SMS consent explicitly.",
            "C'è un campo telefono. Riduce un po' gli invii, ma permette promemoria via SMS/WhatsApp che aumentano molto le presenze. Jay Shetty chiede esplicitamente il consenso agli SMS."
          ),
          weight: 0,
          standard: STANDARDS.callFunnel,
        });
      }
    }
  }

  findings.push({
    id: "after-booking",
    label: tr("After-booking sequence (check manually)", "Sequenza dopo la prenotazione (da verificare a mano)"),
    status: "info",
    detail: tr(
      "Can't be verified without booking. The leaders' standard for show-up rate: a confirmation page with a short video from the coach, what to prepare, add-to-calendar, and email + SMS/WhatsApp reminders 24h and 1h before.",
      "Non verificabile senza prenotare. Lo standard dei leader per le presenze: pagina di conferma con un breve video del coach, cosa preparare, aggiunta al calendario e promemoria via email + SMS/WhatsApp 24 ore e 1 ora prima."
    ),
    weight: 0,
    standard: STANDARDS.callFunnel,
    items: [
      { text: tr("Confirmation page with a 1-2 min video: \"here's what we'll do on the call\"", "Pagina di conferma con un video di 1-2 minuti: \"ecco cosa faremo nella call\"") },
      { text: tr("Pre-call homework or short questionnaire (raises commitment)", "Compito o breve questionario prima della call (aumenta l'impegno)") },
      { text: tr("Add-to-calendar link + reminders at 24h and 1h (email + SMS/WhatsApp)", "Link \"aggiungi al calendario\" + promemoria a 24 ore e 1 ora (email + SMS/WhatsApp)") },
      { text: tr("A case study or testimonial sent before the call", "Un caso studio o una testimonianza inviati prima della call") },
      { text: tr("Easy reschedule link (a rescheduled call beats a no-show)", "Link facile per spostare l'appuntamento (una call spostata è meglio di un'assenza)") },
    ],
  });

  return category(
    "callFunnel",
    tr("Free-Call Funnel", "Funnel a call gratuita"),
    tr(
      "How well the page sells the free call and how smooth and qualifying the booking step is, benchmarked against Tony Robbins, Clients on Demand, Jay Shetty and Consulting.com.",
      "Quanto bene la pagina vende la call gratuita e quanto la prenotazione è fluida e selettiva, a confronto con Tony Robbins, Clients on Demand, Jay Shetty e Consulting.com."
    ),
    findings
  );
}

export function funnelInfo(detection: FunnelDetection, mode: FunnelMode, next: BookingStep): FunnelInfo {
  return { type: detection.type, detected: mode === "auto", reason: detection.reason, steps: next.steps };
}
