import { CategoryResult, Finding, FunnelType } from "../types";
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
  const timeframeInHero = TIMEFRAME.test(ctx.heroText);
  findings.push({
    id: "timeframe",
    label: "Time-to-result is explicit",
    status: timeframeInHero ? "pass" : timeframe ? "warn" : "fail",
    detail: timeframeInHero
      ? `The hero states a concrete timeframe ("${firstMatch(ctx.heroText, TIMEFRAME)}"). Shrinking perceived time delay directly raises perceived value.`
      : timeframe
      ? `A timeframe appears on the page ("${timeframe}") but not in the headline area. Put the time-to-result next to the promise (e.g. "…in 90 days").`
      : "No program length or time-to-result found (e.g. \"12-week program\", \"in 90 giorni\"). Buyers discount any outcome that has no timeline.",
    weight: 2,
    standard: STANDARDS.hormozi,
  });

  // --- Effort & sacrifice: what exactly they get and how it's delivered ---
  const deliverables = distinctMatches(bodyText, DELIVERABLES);
  findings.push({
    id: "deliverables",
    label: "Delivery format & support spelled out",
    status: deliverables.length >= 4 ? "pass" : deliverables.length >= 2 ? "warn" : "fail",
    detail:
      deliverables.length >= 4
        ? `${deliverables.length} concrete delivery elements named (live calls, community, templates, 1:1…). Showing done-with-you support lowers perceived effort.`
        : deliverables.length >= 2
        ? `Only ${deliverables.length} delivery elements named. Spell out the full format: number/frequency of live calls, 1:1 access, community, templates, recordings, access length.`
        : "The page barely says how the coaching is delivered. Buyers need to see the format (group calls, 1:1, community, materials) to picture the effort involved.",
    weight: 3,
    standard: STANDARDS.hormozi,
    items: deliverables.length > 0 ? matchItems(finalUrl, deliverables) : undefined,
  });

  const curriculum = distinctMatches(`${ctx.headingText} ${bodyText}`, CURRICULUM);
  const listItems = $("li").length;
  findings.push({
    id: "curriculum",
    label: "Curriculum / roadmap is visible",
    status: curriculum.length >= 3 ? "pass" : curriculum.length >= 1 ? "warn" : "fail",
    detail:
      curriculum.length >= 3
        ? `A program breakdown is present (${curriculum.slice(0, 4).join(", ")}…). A named, step-by-step path makes success feel more likely.`
        : curriculum.length >= 1
        ? "Some program structure is mentioned but there's no clear module-by-module or week-by-week breakdown. Show the roadmap with a named outcome per step."
        : `No curriculum, modules or roadmap found${listItems ? "" : " and no lists at all"}. Top coaching pages show exactly what happens in each module/phase.`,
    weight: 3,
    standard: STANDARDS.brunson,
    items: curriculum.length > 0 ? matchItems(finalUrl, curriculum) : undefined,
  });

  if (!sellsOnPage) {
    findings.push({
      id: "price-on-call",
      label: "Price, stack & bonuses",
      status: "info",
      detail:
        "Not scored: in a free-call funnel the investment, offer stack and bonuses are presented on the call. The page's job is to sell the call (see Free-Call Funnel).",
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
    const hasAnchor = strikePrices.length > 0 || !!valueAnchor;
    findings.push({
      id: "value-stack",
      label: "Offer stack with value anchoring",
      status: hasAnchor ? "pass" : "warn",
      detail: hasAnchor
        ? `The offer is anchored against a higher value (${strikePrices.length > 0 ? `struck-through price "${strikePrices[0]}"` : `"${valueAnchor}"`}). Stacking each component with its value is the standard "Stack" close.`
        : "No value stack found — the page doesn't recap everything included with a value next to each item and a total. The stack makes the price feel small by comparison.",
      weight: 2,
      standard: STANDARDS.brunson,
    });

    if (strikePrices.length > 0 && EU_LANGUAGES.has(ctx.language.code)) {
      findings.push({
        id: "eu-price-reduction",
        label: "EU price-reduction rules",
        status: "info",
        detail:
          "A struck-through price was found on a page aimed at an EU audience. Under the Omnibus Directive, an announced price reduction must show the lowest price applied in the previous 30 days. Make sure the \"was\" price is genuine.",
        weight: 1,
        standard: STANDARDS.euConsumer,
      });
    }

    const bonuses = distinctMatches(`${ctx.headingText} ${bodyText}`, BONUS);
    findings.push({
      id: "bonuses",
      label: "Bonuses that remove specific obstacles",
      status: bonuses.length > 0 ? "pass" : "warn",
      detail:
        bonuses.length > 0
          ? "Bonuses are included. The strongest bonuses each solve a specific objection (time, confidence, tech)."
          : "No bonuses found. Hormozi and Brunson both use bonuses aimed at the buyer's next obstacle to raise value without discounting.",
      weight: 1,
      standard: STANDARDS.hormozi,
    });

    // --- Price / application ---
    const priceMatch = bodyText.match(PRICE);
    const application = firstMatch(`${bodyText} ${ctx.ctaTexts.join(" ")}`, APPLICATION_FUNNEL);
    findings.push({
      id: "pricing",
      label: "Price or application path is clear",
      status: priceMatch ? "pass" : application ? "pass" : "warn",
      detail: priceMatch
        ? `Price is shown on the page (${priceMatch[0].trim()}). Pricing openness filters in serious buyers and removes a click-away reason.`
        : application
        ? `No public price, but there's an application / call step ("${application}"). That's standard for high-ticket coaching; make sure the page still states the investment range or who qualifies.`
        : "Neither a price nor an application/call step was found. Visitors can't tell what the investment is or how to get it.",
      weight: 2,
      standard: STANDARDS.cro,
    });

    if (priceMatch) {
      const plan = firstMatch(bodyText, PAYMENT_PLAN);
      findings.push({
        id: "payment-plan",
        label: "Payment plan option",
        status: plan ? "pass" : "warn",
        detail: plan
          ? `A payment plan is offered ("${plan}"). Splitting the payment usually lifts take-rate for programs over ~€/$500.`
          : "No payment plan / installments found. Offering a split payment (e.g. 3× or monthly) is standard for coaching programs and reduces sticker shock.",
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
    label: "Guarantee / risk reversal",
    status: specific ? "pass" : guarantee ? "warn" : sellsOnPage ? "fail" : "info",
    detail: specific
      ? `A specific guarantee is stated ("${specific}"). Named, time-bound guarantees get the most trust.`
      : guarantee
      ? `A guarantee is mentioned ("${guarantee}") but without concrete terms. Name it and add a duration and condition (e.g. "30-day do-the-work guarantee").`
      : sellsOnPage
      ? "No guarantee or risk reversal found. For coaching (an intangible, high-trust purchase) a conditional or unconditional guarantee is one of the biggest conversion levers."
      : "No guarantee on the page. Optional in a call funnel (it's usually presented on the call), but mentioning one (\"results guarantee\", \"soddisfatti o rimborsati\") makes booking feel safer.",
    weight: sellsOnPage ? 3 : 1,
    standard: STANDARDS.hormozi,
  });

  return category(
    "offer",
    "Offer Strength",
    "How compelling the program offer is: time-to-result, delivery format, curriculum, offer stack, bonuses, pricing and guarantee (Hormozi's Value Equation).",
    findings
  );
}
