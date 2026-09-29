import { CategoryResult, Finding, FunnelType, tr } from "../types";
import { CoachingContext, category, firstMatch, matchItems } from "./context";
import {
  APPLICATION_FUNNEL,
  BONUS,
  CURRICULUM,
  DELIVERABLES,
  GUARANTEE,
  GUARANTEE_SPECIFIC,
  PAYMENT_PLAN,
  PRICE,
  TIMEFRAME,
  VALUE_ANCHOR,
  distinctMatches,
} from "./patterns";
import { STANDARDS } from "./standards";

// EU pages showing a struck-through "was" price fall under the Omnibus
// Directive (price reductions must reference the lowest price of the prior
// 30 days) — flagged as info so the coach can double-check compliance.
const EU_LANGUAGES = new Set(["it", "es", "fr", "de", "pt"]);

/**
 * Offer strength, structured around Hormozi's Value Equation:
 *   Value = (Dream Outcome × Perceived Likelihood) / (Time Delay × Effort & Sacrifice)
 * plus the offer-stack mechanics (stack, anchor, bonuses, price, guarantee)
 * that every high-converting coaching sales page presents.
 * Dream outcome and likelihood are scored under Sales Page Structure and
 * Trust & Proof respectively, so they aren't double-counted here.
 */
export function analyzeOffer(ctx: CoachingContext, funnel: FunnelType): CategoryResult {
  // In a free-call funnel the price, stack and bonuses are presented on the
  // call, not the page (Tony Robbins, Clients on Demand, Jay Shetty all hide
  // them), so those checks only apply to direct-purchase pages.
  const sellsOnPage = funnel === "checkout";
  const { $, bodyText, finalUrl } = ctx;
  const findings: Finding[] = [];

  // --- Time delay ---
  const timeframe = firstMatch(bodyText, TIMEFRAME);
  const heroTimeframe = firstMatch(ctx.heroText, TIMEFRAME);
  findings.push({
    id: "timeframe",
    label: tr("Time-to-result is explicit", "Tempo per il risultato esplicito"),
    status: heroTimeframe ? "pass" : timeframe ? "warn" : "fail",
    detail: heroTimeframe
      ? tr(
          `The hero states a concrete timeframe ("${heroTimeframe}"). Shrinking perceived time delay directly raises perceived value.`,
          `L'apertura indica un tempo concreto ("${heroTimeframe}"). Ridurre l'attesa percepita aumenta direttamente il valore percepito.`
        )
      : timeframe
      ? tr(
          `A timeframe appears on the page ("${timeframe}") but not in the headline area. Put the time-to-result next to the promise (e.g. "…in 90 days").`,
          `Un tempo compare nella pagina ("${timeframe}") ma non nella zona del titolo. Metti il tempo per il risultato accanto alla promessa (es. "…in 90 giorni").`
        )
      : tr(
          "No program length or time-to-result found (e.g. \"12-week program\", \"in 90 days\"). Buyers discount any outcome that has no timeline.",
          "Nessuna durata del percorso né tempo per il risultato (es. \"percorso di 12 settimane\", \"in 90 giorni\"). Chi compra svaluta qualsiasi risultato senza una tempistica."
        ),
    weight: 2,
    standard: STANDARDS.hormozi,
  });

  // --- Effort & sacrifice: what exactly they get and how it's delivered ---
  const deliverables = distinctMatches(bodyText, DELIVERABLES);
  findings.push({
    id: "deliverables",
    label: tr("Delivery format & support spelled out", "Formato e supporto spiegati chiaramente"),
    status: deliverables.length >= 4 ? "pass" : deliverables.length >= 2 ? "warn" : "fail",
    detail:
      deliverables.length >= 4
        ? tr(
            `${deliverables.length} concrete delivery elements named (live calls, community, templates, 1:1…). Showing done-with-you support lowers perceived effort.`,
            `${deliverables.length} elementi concreti di erogazione citati (call live, community, template, 1:1…). Mostrare un supporto "fatto insieme" riduce lo sforzo percepito.`
          )
        : deliverables.length >= 2
        ? tr(
            `Only ${deliverables.length} delivery elements named. Spell out the full format: number/frequency of live calls, 1:1 access, community, templates, recordings, access length.`,
            `Solo ${deliverables.length} elementi di erogazione citati. Descrivi il formato completo: numero/frequenza delle call live, accesso 1:1, community, template, registrazioni, durata dell'accesso.`
          )
        : tr(
            "The page barely says how the coaching is delivered. Buyers need to see the format (group calls, 1:1, community, materials) to picture the effort involved.",
            "La pagina dice a malapena come si svolge il coaching. Chi compra deve vedere il formato (call di gruppo, 1:1, community, materiali) per immaginare l'impegno richiesto."
          ),
    weight: 3,
    standard: STANDARDS.hormozi,
    items: deliverables.length > 0 ? matchItems(finalUrl, deliverables) : undefined,
  });

  const curriculum = distinctMatches(`${ctx.headingText} ${bodyText}`, CURRICULUM);
  const listItems = $("li").length;
  findings.push({
    id: "curriculum",
    label: tr("Curriculum / roadmap is visible", "Programma / roadmap visibile"),
    status: curriculum.length >= 3 ? "pass" : curriculum.length >= 1 ? "warn" : "fail",
    detail:
      curriculum.length >= 3
        ? tr(
            `A program breakdown is present (${curriculum.slice(0, 4).join(", ")}…). A named, step-by-step path makes success feel more likely.`,
            `È presente il dettaglio del programma (${curriculum.slice(0, 4).join(", ")}…). Un percorso con nomi e passaggi chiari fa sembrare il successo più probabile.`
          )
        : curriculum.length >= 1
        ? tr(
            "Some program structure is mentioned but there's no clear module-by-module or week-by-week breakdown. Show the roadmap with a named outcome per step.",
            "Si accenna alla struttura del programma, ma manca un dettaglio chiaro modulo per modulo o settimana per settimana. Mostra la roadmap con un risultato per ogni tappa."
          )
        : tr(
            `No curriculum, modules or roadmap found${listItems ? "" : " and no lists at all"}. Top coaching pages show exactly what happens in each module/phase.`,
            `Nessun programma, modulo o roadmap${listItems ? "" : " e nessun elenco"}. Le migliori pagine di coaching mostrano esattamente cosa succede in ogni modulo/fase.`
          ),
    weight: 3,
    standard: STANDARDS.brunson,
    items: curriculum.length > 0 ? matchItems(finalUrl, curriculum) : undefined,
  });

  if (!sellsOnPage) {
    findings.push({
      id: "price-on-call",
      label: tr("Price, stack & bonuses", "Prezzo, stack e bonus"),
      status: "info",
      detail: tr(
        "Not scored: in a free-call funnel the investment, offer stack and bonuses are presented on the call. The page's job is to sell the call (see Free-Call Funnel).",
        "Non valutato: in un funnel a call gratuita investimento, stack dell'offerta e bonus si presentano durante la call. Il compito della pagina è vendere la call (vedi Funnel a call gratuita)."
      ),
      weight: 0,
      standard: STANDARDS.callFunnel,
    });
  } else {
    // --- Offer stack ---
    const strikePrices = $("s, del, strike")
      .filter((_, el) => /\d/.test($(el).text()))
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get();
    const valueAnchor = firstMatch(bodyText, VALUE_ANCHOR);
    const anchor = strikePrices.length > 0 ? strikePrices[0] : valueAnchor;
    findings.push({
      id: "value-stack",
      label: tr("Offer stack with value anchoring", "Stack dell'offerta con ancoraggio del valore"),
      status: anchor ? "pass" : "warn",
      detail: anchor
        ? tr(
            `The offer is anchored against a higher value (${strikePrices.length > 0 ? `struck-through price "${anchor}"` : `"${anchor}"`}). Stacking each component with its value is the standard "Stack" close.`,
            `L'offerta è ancorata a un valore più alto (${strikePrices.length > 0 ? `prezzo barrato "${anchor}"` : `"${anchor}"`}). Elencare ogni componente con il suo valore è la classica chiusura "Stack".`
          )
        : tr(
            "No value stack found — the page doesn't recap everything included with a value next to each item and a total. The stack makes the price feel small by comparison.",
            "Nessuno stack del valore: la pagina non riepiloga tutto ciò che è incluso con il valore di ogni elemento e un totale. Lo stack fa sembrare il prezzo piccolo al confronto."
          ),
      weight: 2,
      standard: STANDARDS.brunson,
    });

    if (strikePrices.length > 0 && EU_LANGUAGES.has(ctx.language.code)) {
      findings.push({
        id: "eu-price-reduction",
        label: tr("EU price-reduction rules", "Regole UE sugli sconti"),
        status: "info",
        detail: tr(
          "A struck-through price was found on a page aimed at an EU audience. Under the Omnibus Directive, an announced price reduction must show the lowest price applied in the previous 30 days. Make sure the \"was\" price is genuine.",
          "C'è un prezzo barrato su una pagina rivolta a un pubblico UE. Con la Direttiva Omnibus, uno sconto annunciato deve indicare il prezzo più basso applicato nei 30 giorni precedenti. Verifica che il prezzo \"di partenza\" sia reale."
        ),
        weight: 1,
        standard: STANDARDS.euConsumer,
      });
    }

    const bonuses = distinctMatches(`${ctx.headingText} ${bodyText}`, BONUS);
    findings.push({
      id: "bonuses",
      label: tr("Bonuses that remove specific obstacles", "Bonus che rimuovono ostacoli specifici"),
      status: bonuses.length > 0 ? "pass" : "warn",
      detail:
        bonuses.length > 0
          ? tr(
              "Bonuses are included. The strongest bonuses each solve a specific objection (time, confidence, tech).",
              "Sono inclusi dei bonus. I bonus più forti risolvono ciascuno un'obiezione specifica (tempo, fiducia, tecnologia)."
            )
          : tr(
              "No bonuses found. Hormozi and Brunson both use bonuses aimed at the buyer's next obstacle to raise value without discounting.",
              "Nessun bonus. Hormozi e Brunson usano bonus mirati al prossimo ostacolo di chi compra, per aumentare il valore senza fare sconti."
            ),
      weight: 1,
      standard: STANDARDS.hormozi,
    });

    // --- Price / application ---
    const priceMatch = bodyText.match(PRICE);
    const application = firstMatch(`${bodyText} ${ctx.ctaTexts.join(" ")}`, APPLICATION_FUNNEL);
    findings.push({
      id: "pricing",
      label: tr("Price or application path is clear", "Prezzo o percorso di candidatura chiari"),
      status: priceMatch || application ? "pass" : "warn",
      detail: priceMatch
        ? tr(
            `Price is shown on the page (${priceMatch[0].trim()}). Pricing openness filters in serious buyers and removes a click-away reason.`,
            `Il prezzo è indicato nella pagina (${priceMatch[0].trim()}). La trasparenza sul prezzo attira chi è davvero interessato e toglie un motivo per andarsene.`
          )
        : application
        ? tr(
            `No public price, but there's an application / call step ("${application}"). That's standard for high-ticket coaching; make sure the page still states the investment range or who qualifies.`,
            `Nessun prezzo pubblico, ma c'è un passaggio di candidatura / call ("${application}"). È la norma nel coaching high-ticket; assicurati però che la pagina indichi la fascia d'investimento o chi è idoneo.`
          )
        : tr(
            "Neither a price nor an application/call step was found. Visitors can't tell what the investment is or how to get it.",
            "Nessun prezzo né passaggio di candidatura/call. I visitatori non capiscono qual è l'investimento né come accedere."
          ),
      weight: 2,
      standard: STANDARDS.cro,
    });

    if (priceMatch) {
      const plan = firstMatch(bodyText, PAYMENT_PLAN);
      findings.push({
        id: "payment-plan",
        label: tr("Payment plan option", "Pagamento rateale"),
        status: plan ? "pass" : "warn",
        detail: plan
          ? tr(
              `A payment plan is offered ("${plan}"). Splitting the payment usually lifts take-rate for programs over ~€/$500.`,
              `È offerto un pagamento rateale ("${plan}"). Rateizzare di solito aumenta le adesioni per i programmi sopra i ~500 €.`
            )
          : tr(
              "No payment plan / installments found. Offering a split payment (e.g. 3× or monthly) is standard for coaching programs and reduces sticker shock.",
              "Nessun pagamento rateale. Offrire il pagamento in più rate (es. 3 rate o mensile) è la norma nei programmi di coaching e riduce lo shock da prezzo."
            ),
        weight: 1,
        standard: STANDARDS.cro,
      });
    }
  }

  // --- Risk reversal ---
  const guarantee = firstMatch(bodyText, GUARANTEE);
  const specific = firstMatch(bodyText, GUARANTEE_SPECIFIC);
  findings.push({
    id: "guarantee",
    label: tr("Guarantee / risk reversal", "Garanzia / inversione del rischio"),
    status: specific ? "pass" : guarantee ? "warn" : sellsOnPage ? "fail" : "info",
    detail: specific
      ? tr(
          `A specific guarantee is stated ("${specific}"). Named, time-bound guarantees get the most trust.`,
          `È indicata una garanzia specifica ("${specific}"). Le garanzie con un nome e una durata ispirano più fiducia.`
        )
      : guarantee
      ? tr(
          `A guarantee is mentioned ("${guarantee}") but without concrete terms. Name it and add a duration and condition (e.g. "30-day do-the-work guarantee").`,
          `Si cita una garanzia ("${guarantee}") ma senza condizioni concrete. Dalle un nome, una durata e una condizione (es. "garanzia di 30 giorni se fai gli esercizi").`
        )
      : sellsOnPage
      ? tr(
          "No guarantee or risk reversal found. For coaching (an intangible, high-trust purchase) a conditional or unconditional guarantee is one of the biggest conversion levers.",
          "Nessuna garanzia né inversione del rischio. Nel coaching (un acquisto intangibile che richiede fiducia) una garanzia, condizionata o no, è una delle leve di conversione più forti."
        )
      : tr(
          "No guarantee on the page. Optional in a call funnel (it's usually presented on the call), but mentioning one (\"results guarantee\", \"money-back guarantee\") makes booking feel safer.",
          "Nessuna garanzia nella pagina. Facoltativa in un funnel a call (di solito si presenta durante la call), ma citarne una (\"garanzia sui risultati\", \"soddisfatti o rimborsati\") rende la prenotazione più sicura."
        ),
    weight: sellsOnPage ? 3 : 1,
    standard: STANDARDS.hormozi,
  });

  return category(
    "offer",
    tr("Offer Strength", "Forza dell'offerta"),
    tr(
      "How compelling the program offer is: time-to-result, delivery format, curriculum, offer stack, bonuses, pricing and guarantee (Hormozi's Value Equation).",
      "Quanto è convincente l'offerta del programma: tempo per il risultato, formato, contenuti, stack dell'offerta, bonus, prezzo e garanzia (Value Equation di Hormozi)."
    ),
    findings
  );
}
