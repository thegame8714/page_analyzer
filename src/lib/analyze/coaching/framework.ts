import { CategoryResult, Finding } from "../types";
import { splitWords } from "../textUtils";
import { CoachingContext, category, firstMatch, matchItems } from "./context";
import {
  COACH_STORY,
  COUNTDOWN_SIGNATURE,
  FAQ_SECTION,
  GENERIC_CTA_COPY,
  LEAD_MAGNET,
  NOT_FOR,
  OBJECTIONS,
  OUTCOME,
  PAIN,
  STRONG_CTA_COPY,
  URGENCY,
  VISION,
  WHO_FOR,
  distinctMatches,
  phrasesGlobal,
} from "./patterns";
import { STANDARDS } from "./standards";

// Per-language pronoun sets: pooling them would misfire (Italian "i" is an
// article, "sono" is also "they are"), so each language only uses its own.
const PRONOUNS: Record<string, { you: RegExp; self: RegExp }> = {
  en: {
    you: phrasesGlobal("you", "your", "yours", "you're", "you'll", "you've", "yourself"),
    self: phrasesGlobal("i", "me", "my", "mine", "we", "our", "us", "i'm", "we're", "i've"),
  },
  it: {
    you: phrasesGlobal("tu", "ti", "te", "tuo", "tua", "tuoi", "tue", "vuoi", "puoi", "sei", "hai"),
    self: phrasesGlobal("io", "mio", "mia", "miei", "mie", "noi", "nostro", "nostra", "nostri", "nostre", "ho", "abbiamo"),
  },
  es: {
    you: phrasesGlobal("tú", "tu", "tus", "te", "ti", "usted", "puedes", "quieres"),
    self: phrasesGlobal("yo", "mí", "mi", "mis", "nosotros", "nuestro", "nuestra", "tengo"),
  },
  fr: {
    you: phrasesGlobal("tu", "toi", "ton", "ta", "tes", "vous", "votre", "vos"),
    self: phrasesGlobal("je", "moi", "mon", "ma", "mes", "nous", "notre", "nos"),
  },
  de: {
    you: phrasesGlobal("du", "dich", "dir", "dein", "deine", "ihr", "sie"),
    self: phrasesGlobal("ich", "mich", "mir", "mein", "meine", "wir", "uns", "unser"),
  },
  pt: {
    you: phrasesGlobal("você", "voce", "seu", "sua", "seus", "suas", "te"),
    self: phrasesGlobal("eu", "meu", "minha", "nós", "nosso", "nossa"),
  },
};

/**
 * Sales-page structure benchmarked against the section order the leading
 * coaching sales pages share (Brunson's Expert Secrets sales letter,
 * StoryBrand SB7, classic Problem-Agitate-Solve): hook → avatar → pain →
 * vision → guide/authority → plan → proof → offer → objections → CTA.
 */
export function analyzeFramework(ctx: CoachingContext): CategoryResult {
  const { $, bodyText, heroText, h1, finalUrl } = ctx;
  const findings: Finding[] = [];

  // Hook: the headline must sell an outcome, not name the program.
  const heroOutcome = firstMatch(heroText, OUTCOME);
  const h1Words = h1 ? h1.split(/\s+/).length : 0;
  findings.push({
    id: "headline-outcome",
    label: "Headline sells a transformation",
    status: !h1 ? "fail" : heroOutcome && h1Words >= 4 && h1Words <= 18 ? "pass" : heroOutcome || (h1Words >= 4 && h1Words <= 18) ? "warn" : "fail",
    detail: !h1
      ? "No H1 headline found. The hero needs one headline stating the outcome the client gets."
      : heroOutcome && h1Words >= 4 && h1Words <= 18
      ? `Headline "${h1}" leads with outcome language ("${heroOutcome}"). Strong hooks sell the result, not the program's name.`
      : heroOutcome
      ? `Outcome language is in the hero ("${heroOutcome}") but the H1 "${h1}" is ${h1Words} words. Aim for 6-14 words: [Desired result] + [timeframe] + [without the main objection].`
      : `Headline "${h1}" doesn't clearly promise an outcome. Use the "[Result] in [time] without [pain]" formula so visitors see what they get in 5 seconds.`,
    weight: 3,
    standard: STANDARDS.brunson,
  });

  // Avatar callout.
  const whoFor = firstMatch(bodyText, WHO_FOR);
  const whoForInHero = WHO_FOR.test(heroText);
  findings.push({
    id: "who-for",
    label: "Calls out the ideal client",
    status: whoForInHero ? "pass" : whoFor ? "pass" : "fail",
    detail: whoFor
      ? `The page names who it's for ("${whoFor}")${whoForInHero ? " right in the hero" : ""}. A specific avatar makes the right people feel "this is about me".`
      : "The page never says who the program is for. Add a \"This is for you if…\" section (and name the avatar in the subheadline).",
    weight: 3,
    standard: STANDARDS.storybrand,
  });

  const notFor = firstMatch(bodyText, NOT_FOR);
  findings.push({
    id: "not-for",
    label: "\"Who this is NOT for\" disqualifier",
    status: notFor ? "pass" : "warn",
    detail: notFor
      ? `A disqualifier section exists ("${notFor}"). Telling the wrong people not to buy increases trust with the right ones and cuts refunds.`
      : "No \"This is NOT for you if…\" section. Top coaching pages use a disqualifier to build credibility and pre-qualify buyers.",
    weight: 1,
    standard: STANDARDS.brunson,
  });

  // Problem / agitation.
  const pains = distinctMatches(bodyText, PAIN);
  findings.push({
    id: "pain",
    label: "Problem & pain agitation",
    status: pains.length >= 3 ? "pass" : pains.length >= 1 ? "warn" : "fail",
    detail:
      pains.length >= 3
        ? `The page speaks to the visitor's current pain (${pains.slice(0, 4).map((p) => `"${p}"`).join(", ")}). Naming the problem in their words creates the "they get me" moment.`
        : pains.length >= 1
        ? "The problem is only lightly touched. Describe the external, internal and philosophical problem (StoryBrand) in the client's own words before presenting the solution."
        : "No problem/pain section detected. Without Problem → Agitation, the solution has nothing to relieve.",
    weight: 2,
    standard: STANDARDS.copywriting,
    items: pains.length > 0 ? matchItems(finalUrl, pains) : undefined,
  });

  const vision = firstMatch(bodyText, VISION);
  findings.push({
    id: "vision",
    label: "Paints the after-state (success vision)",
    status: vision ? "pass" : "warn",
    detail: vision
      ? `The page helps the reader picture life after the program ("${vision}").`
      : "No \"imagine…\" / after-state section. StoryBrand's success step shows what life looks like once the problem is solved; that's what people actually buy.",
    weight: 1,
    standard: STANDARDS.storybrand,
  });

  // Guide / authority story.
  const story = firstMatch(`${ctx.headingText} ${bodyText}`, COACH_STORY);
  const hasPersonSchema = /"@type"\s*:\s*"Person"/i.test(ctx.html);
  findings.push({
    id: "coach-story",
    label: "Coach introduction & origin story",
    status: story ? "pass" : hasPersonSchema ? "warn" : "fail",
    detail: story
      ? `The coach is introduced ("${story}"). An origin story ("I was where you are") plus proof makes the coach the credible guide.`
      : hasPersonSchema
      ? "Person schema exists, but the page has no visible \"Meet your coach\" section. Buyers of coaching buy the coach; show face, story and credentials."
      : "No \"Meet your coach\" / \"Chi sono\" section. Coaching is a trust purchase: show who will guide them, why they're qualified and their own before/after.",
    weight: 3,
    standard: STANDARDS.brunson,
  });

  // FAQ & objections.
  const faqMarkup = $("details summary").length + $('[class*="faq" i], [id*="faq" i], [class*="accordion" i]').length;
  const faqHeading = FAQ_SECTION.test(ctx.headingText) || FAQ_SECTION.test(bodyText);
  const coveredObjections = OBJECTIONS.filter((o) => o.re.test(bodyText)).map((o) => o.label);
  const missingObjections = OBJECTIONS.filter((o) => !coveredObjections.includes(o.label)).map((o) => o.label);
  const hasFaq = faqHeading || faqMarkup >= 3;
  findings.push({
    id: "faq",
    label: "FAQ handles the big objections",
    status: hasFaq && coveredObjections.length >= 3 ? "pass" : hasFaq || coveredObjections.length >= 2 ? "warn" : "fail",
    detail: hasFaq
      ? `FAQ section found; it addresses ${coveredObjections.length}/${OBJECTIONS.length} core coaching objections.${
          missingObjections.length ? ` Missing: ${missingObjections.join(", ")}.` : ""
        }`
      : `No FAQ section found. ${coveredObjections.length}/${OBJECTIONS.length} core objections are addressed elsewhere. Add an FAQ covering time, money/refunds, "will it work for me", logistics and "how is this different".`,
    weight: 2,
    standard: STANDARDS.brunson,
  });

  // CTA repetition & copy.
  const ctaCount = ctx.ctaTexts.length;
  findings.push({
    id: "cta-repetition",
    label: "CTA repeated after each major section",
    status: ctaCount >= 4 ? "pass" : ctaCount >= 2 ? "warn" : "fail",
    detail:
      ctaCount >= 4
        ? `${ctaCount} CTA buttons/links across the page. Long-form sales pages should offer the next step wherever a reader becomes convinced.`
        : ctaCount >= 2
        ? `Only ${ctaCount} CTAs. Long-form coaching pages typically repeat the CTA after the hero, the offer, testimonials, the guarantee and the FAQ.`
        : "One or no CTA on the page. Readers who get convinced mid-page have nowhere to click.",
    weight: 2,
    standard: STANDARDS.cro,
  });

  const strong = ctx.ctaTexts.filter((t) => STRONG_CTA_COPY.test(t));
  const generic = ctx.ctaTexts.filter((t) => GENERIC_CTA_COPY.test(t) && !STRONG_CTA_COPY.test(t));
  if (ctaCount > 0) {
    findings.push({
      id: "cta-copy",
      label: "CTA copy is first-person & benefit-led",
      status: strong.length > 0 && generic.length <= strong.length ? "pass" : "warn",
      detail:
        strong.length > 0 && generic.length <= strong.length
          ? `CTAs use ownership language (e.g. "${strong[0]}"). First-person CTAs ("Yes, I want my spot") consistently beat generic ones.`
          : generic.length > 0
          ? `Generic CTA copy found (e.g. "${generic[0]}"). Replace it with first-person, outcome-led copy like "Yes, reserve my spot" / "Sì, voglio il mio posto".`
          : `CTAs are functional (e.g. "${ctx.ctaTexts[0]}") but not first-person. Try "Start my transformation" / "Voglio iniziare" framing.`,
      weight: 1,
      standard: STANDARDS.cro,
    });
  }

  // You-focus.
  const pronouns = PRONOUNS[ctx.language.code] ?? PRONOUNS.en;
  const youCount = (bodyText.match(pronouns.you) ?? []).length;
  const selfCount = (bodyText.match(pronouns.self) ?? []).length;
  const ratio = youCount / Math.max(1, selfCount);
  if (splitWords(bodyText).length > 150) {
    findings.push({
      id: "you-focus",
      label: "Client-focused copy (you vs. I/we)",
      status: ratio >= 1.5 ? "pass" : ratio >= 0.8 ? "warn" : "fail",
      detail: `"You" words appear ${youCount}× vs. "I/we" words ${selfCount}× (ratio ${ratio.toFixed(1)}). ${
        ratio >= 1.5
          ? "The copy keeps the client as the hero."
          : "Rewrite coach-centric passages so the client is the hero and the coach is the guide (aim for at least 1.5× more \"you\")."
      }`,
      weight: 1,
      standard: STANDARDS.storybrand,
    });
  }

  // Urgency & scarcity.
  const urgency = firstMatch(bodyText, URGENCY);
  const countdown = COUNTDOWN_SIGNATURE.test(ctx.html);
  findings.push({
    id: "urgency",
    label: "Genuine urgency (cohort date / enrollment window)",
    status: urgency ? "pass" : countdown ? "pass" : "warn",
    detail: urgency
      ? `Urgency found ("${urgency}"). Real deadlines (cohort start, enrollment closing, limited seats) are standard in launch-style coaching funnels. Keep them truthful.`
      : countdown
      ? "A countdown/timer script was detected. Make sure the deadline is real and visible near the CTA."
      : "No reason to act now: no cohort start date, enrollment deadline or seat limit. Without honest urgency many interested buyers postpone indefinitely.",
    weight: 2,
    standard: STANDARDS.cialdini,
  });

  // Low-commitment path.
  const leadMagnet = firstMatch(bodyText, LEAD_MAGNET);
  findings.push({
    id: "lead-path",
    label: "Low-commitment next step for not-ready visitors",
    status: leadMagnet ? "pass" : "info",
    detail: leadMagnet
      ? `A lower-commitment entry point exists ("${leadMagnet}") so not-yet-ready visitors can still join your list.`
      : "No free training, webinar, quiz or challenge offered as a secondary path. Optional, but most coaching funnels capture undecided visitors instead of losing them.",
    weight: 1,
    standard: STANDARDS.brunson,
  });

  return category(
    "framework",
    "Sales Page Structure",
    "Whether the page follows the proven coaching sales-page arc: outcome hook → avatar → pain → vision → coach story → objections → repeated CTA → urgency.",
    findings
  );
}
