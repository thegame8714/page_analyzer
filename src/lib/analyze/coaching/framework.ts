import { CategoryResult, Finding, tr } from "../types";
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
    label: tr("Headline sells a transformation", "Il titolo vende una trasformazione"),
    status: !h1 ? "fail" : heroOutcome && h1Words >= 4 && h1Words <= 18 ? "pass" : heroOutcome || (h1Words >= 4 && h1Words <= 18) ? "warn" : "fail",
    detail: !h1
      ? tr(
          "No H1 headline found. The hero needs one headline stating the outcome the client gets.",
          "Nessun titolo H1. L'apertura ha bisogno di un titolo che dichiari il risultato che il cliente ottiene."
        )
      : heroOutcome && h1Words >= 4 && h1Words <= 18
      ? tr(
          `Headline "${h1}" leads with outcome language ("${heroOutcome}"). Strong hooks sell the result, not the program's name.`,
          `Il titolo "${h1}" punta sul risultato ("${heroOutcome}"). Gli agganci efficaci vendono il risultato, non il nome del programma.`
        )
      : heroOutcome
      ? tr(
          `Outcome language is in the hero ("${heroOutcome}") but the H1 "${h1}" is ${h1Words} words. Aim for 6-14 words: [Desired result] + [timeframe] + [without the main objection].`,
          `Nell'apertura c'è un linguaggio orientato al risultato ("${heroOutcome}"), ma l'H1 "${h1}" è di ${h1Words} parole. Punta a 6-14 parole: [risultato desiderato] + [tempo] + [senza l'obiezione principale].`
        )
      : tr(
          `Headline "${h1}" doesn't clearly promise an outcome. Use the "[Result] in [time] without [pain]" formula so visitors see what they get in 5 seconds.`,
          `Il titolo "${h1}" non promette chiaramente un risultato. Usa la formula "[Risultato] in [tempo] senza [dolore]", così i visitatori capiscono cosa ottengono in 5 secondi.`
        ),
    weight: 3,
    standard: STANDARDS.brunson,
  });

  // Avatar callout.
  const whoFor = firstMatch(bodyText, WHO_FOR);
  const whoForInHero = WHO_FOR.test(heroText);
  findings.push({
    id: "who-for",
    label: tr("Calls out the ideal client", "Chiama in causa il cliente ideale"),
    status: whoForInHero ? "pass" : whoFor ? "pass" : "fail",
    detail: whoFor
      ? tr(
          `The page names who it's for ("${whoFor}")${whoForInHero ? " right in the hero" : ""}. A specific avatar makes the right people feel "this is about me".`,
          `La pagina dice a chi si rivolge ("${whoFor}")${whoForInHero ? " già nell'apertura" : ""}. Un avatar specifico fa pensare alle persone giuste "parla proprio di me".`
        )
      : tr(
          "The page never says who the program is for. Add a \"This is for you if…\" section (and name the avatar in the subheadline).",
          "La pagina non dice mai a chi è rivolto il programma. Aggiungi una sezione \"È per te se…\" (e cita l'avatar nel sottotitolo)."
        ),
    weight: 3,
    standard: STANDARDS.storybrand,
  });

  const notFor = firstMatch(bodyText, NOT_FOR);
  findings.push({
    id: "not-for",
    label: tr("\"Who this is NOT for\" disqualifier", "Sezione \"Per chi NON è\""),
    status: notFor ? "pass" : "warn",
    detail: notFor
      ? tr(
          `A disqualifier section exists ("${notFor}"). Telling the wrong people not to buy increases trust with the right ones and cuts refunds.`,
          `C'è una sezione che esclude chi non è in target ("${notFor}"). Dire alle persone sbagliate di non comprare aumenta la fiducia di quelle giuste e riduce i rimborsi.`
        )
      : tr(
          "No \"This is NOT for you if…\" section. Top coaching pages use a disqualifier to build credibility and pre-qualify buyers.",
          "Manca una sezione \"NON è per te se…\". Le migliori pagine di coaching la usano per guadagnare credibilità e pre-qualificare chi compra."
        ),
    weight: 1,
    standard: STANDARDS.brunson,
  });

  // Problem / agitation.
  const pains = distinctMatches(bodyText, PAIN);
  findings.push({
    id: "pain",
    label: tr("Problem & pain agitation", "Problema e agitazione del dolore"),
    status: pains.length >= 3 ? "pass" : pains.length >= 1 ? "warn" : "fail",
    detail:
      pains.length >= 3
        ? tr(
            `The page speaks to the visitor's current pain (${pains.slice(0, 4).map((p) => `"${p}"`).join(", ")}). Naming the problem in their words creates the "they get me" moment.`,
            `La pagina parla del dolore attuale del visitatore (${pains.slice(0, 4).map((p) => `"${p}"`).join(", ")}). Nominare il problema con le sue parole crea il momento "mi capisce".`
          )
        : pains.length >= 1
        ? tr(
            "The problem is only lightly touched. Describe the external, internal and philosophical problem (StoryBrand) in the client's own words before presenting the solution.",
            "Il problema è appena sfiorato. Descrivi il problema esterno, interno e filosofico (StoryBrand) con le parole del cliente prima di presentare la soluzione."
          )
        : tr(
            "No problem/pain section detected. Without Problem → Agitation, the solution has nothing to relieve.",
            "Nessuna sezione sul problema/dolore. Senza Problema → Agitazione, la soluzione non ha nulla da alleviare."
          ),
    weight: 2,
    standard: STANDARDS.copywriting,
    items: pains.length > 0 ? matchItems(finalUrl, pains) : undefined,
  });

  const vision = firstMatch(bodyText, VISION);
  findings.push({
    id: "vision",
    label: tr("Paints the after-state (success vision)", "Descrive il \"dopo\" (visione del successo)"),
    status: vision ? "pass" : "warn",
    detail: vision
      ? tr(
          `The page helps the reader picture life after the program ("${vision}").`,
          `La pagina aiuta il lettore a immaginare la vita dopo il programma ("${vision}").`
        )
      : tr(
          "No \"imagine…\" / after-state section. StoryBrand's success step shows what life looks like once the problem is solved; that's what people actually buy.",
          "Nessuna sezione \"immagina…\" sul dopo. Il passo \"successo\" di StoryBrand mostra la vita una volta risolto il problema: è quello che le persone comprano davvero."
        ),
    weight: 1,
    standard: STANDARDS.storybrand,
  });

  // Guide / authority story.
  const story = firstMatch(`${ctx.headingText} ${bodyText}`, COACH_STORY);
  const hasPersonSchema = /"@type"\s*:\s*"Person"/i.test(ctx.html);
  findings.push({
    id: "coach-story",
    label: tr("Coach introduction & origin story", "Presentazione del coach e storia personale"),
    status: story ? "pass" : hasPersonSchema ? "warn" : "fail",
    detail: story
      ? tr(
          `The coach is introduced ("${story}"). An origin story ("I was where you are") plus proof makes the coach the credible guide.`,
          `Il coach si presenta ("${story}"). Una storia personale ("ero dove sei tu") più le prove rendono il coach una guida credibile.`
        )
      : hasPersonSchema
      ? tr(
          "Person schema exists, but the page has no visible \"Meet your coach\" section. Buyers of coaching buy the coach; show face, story and credentials.",
          "Esiste lo schema Person, ma nella pagina manca una sezione visibile \"Chi sono\". Chi compra coaching compra il coach: mostra volto, storia e credenziali."
        )
      : tr(
          "No \"Meet your coach\" section. Coaching is a trust purchase: show who will guide them, why they're qualified and their own before/after.",
          "Manca una sezione \"Chi sono\". Il coaching è un acquisto basato sulla fiducia: mostra chi guiderà il cliente, perché è qualificato e il suo prima/dopo."
        ),
    weight: 3,
    standard: STANDARDS.brunson,
  });

  // FAQ & objections.
  const faqMarkup = $("details summary").length + $('[class*="faq" i], [id*="faq" i], [class*="accordion" i]').length;
  const faqHeading = FAQ_SECTION.test(ctx.headingText) || FAQ_SECTION.test(bodyText);
  const coveredObjections = OBJECTIONS.filter((o) => o.re.test(bodyText));
  const missingObjections = OBJECTIONS.filter((o) => !coveredObjections.includes(o));
  const missingList = (lang: "en" | "it") => missingObjections.map((o) => o.label[lang]).join(", ");
  const hasFaq = faqHeading || faqMarkup >= 3;
  findings.push({
    id: "faq",
    label: tr("FAQ handles the big objections", "Le FAQ gestiscono le obiezioni principali"),
    status: hasFaq && coveredObjections.length >= 3 ? "pass" : hasFaq || coveredObjections.length >= 2 ? "warn" : "fail",
    detail: hasFaq
      ? tr(
          `FAQ section found; it addresses ${coveredObjections.length}/${OBJECTIONS.length} core coaching objections.${
            missingObjections.length ? ` Missing: ${missingList("en")}.` : ""
          }`,
          `Sezione FAQ presente; affronta ${coveredObjections.length}/${OBJECTIONS.length} obiezioni principali del coaching.${
            missingObjections.length ? ` Mancano: ${missingList("it")}.` : ""
          }`
        )
      : tr(
          `No FAQ section found. ${coveredObjections.length}/${OBJECTIONS.length} core objections are addressed elsewhere. Add an FAQ covering time, money/refunds, "will it work for me", logistics and "how is this different".`,
          `Nessuna sezione FAQ. ${coveredObjections.length}/${OBJECTIONS.length} obiezioni principali sono affrontate altrove. Aggiungi delle FAQ su tempo, soldi/rimborsi, "funzionerà per me?", logistica e "in cosa è diverso".`
        ),
    weight: 2,
    standard: STANDARDS.brunson,
  });

  // CTA repetition & copy.
  const ctaCount = ctx.ctaTexts.length;
  findings.push({
    id: "cta-repetition",
    label: tr("CTA repeated after each major section", "CTA ripetuta dopo ogni sezione principale"),
    status: ctaCount >= 4 ? "pass" : ctaCount >= 2 ? "warn" : "fail",
    detail:
      ctaCount >= 4
        ? tr(
            `${ctaCount} CTA buttons/links across the page. Long-form sales pages should offer the next step wherever a reader becomes convinced.`,
            `${ctaCount} pulsanti/link di CTA nella pagina. Le pagine di vendita lunghe devono offrire il passo successivo ovunque il lettore si convinca.`
          )
        : ctaCount >= 2
        ? tr(
            `Only ${ctaCount} CTAs. Long-form coaching pages typically repeat the CTA after the hero, the offer, testimonials, the guarantee and the FAQ.`,
            `Solo ${ctaCount} CTA. Le pagine di coaching lunghe di solito ripetono la CTA dopo l'apertura, l'offerta, le testimonianze, la garanzia e le FAQ.`
          )
        : tr(
            "One or no CTA on the page. Readers who get convinced mid-page have nowhere to click.",
            "Una sola CTA o nessuna. Chi si convince a metà pagina non ha dove cliccare."
          ),
    weight: 2,
    standard: STANDARDS.cro,
  });

  const strong = ctx.ctaTexts.filter((t) => STRONG_CTA_COPY.test(t));
  const generic = ctx.ctaTexts.filter((t) => GENERIC_CTA_COPY.test(t) && !STRONG_CTA_COPY.test(t));
  if (ctaCount > 0) {
    findings.push({
      id: "cta-copy",
      label: tr("CTA copy is first-person & benefit-led", "Testo delle CTA in prima persona e orientato al beneficio"),
      status: strong.length > 0 && generic.length <= strong.length ? "pass" : "warn",
      detail:
        strong.length > 0 && generic.length <= strong.length
          ? tr(
              `CTAs use ownership language (e.g. "${strong[0]}"). First-person CTAs ("Yes, I want my spot") consistently beat generic ones.`,
              `Le CTA usano un linguaggio di appartenenza (es. "${strong[0]}"). Le CTA in prima persona ("Sì, voglio il mio posto") battono costantemente quelle generiche.`
            )
          : generic.length > 0
          ? tr(
              `Generic CTA copy found (e.g. "${generic[0]}"). Replace it with first-person, outcome-led copy like "Yes, reserve my spot".`,
              `Testo delle CTA generico (es. "${generic[0]}"). Sostituiscilo con un testo in prima persona e orientato al risultato, come "Sì, voglio il mio posto".`
            )
          : tr(
              `CTAs are functional (e.g. "${ctx.ctaTexts[0]}") but not first-person. Try "Start my transformation" framing.`,
              `Le CTA sono funzionali (es. "${ctx.ctaTexts[0]}") ma non in prima persona. Prova formule come "Voglio iniziare".`
            ),
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
      label: tr("Client-focused copy (you vs. I/we)", "Testo centrato sul cliente (tu vs. io/noi)"),
      status: ratio >= 1.5 ? "pass" : ratio >= 0.8 ? "warn" : "fail",
      detail: tr(
        `"You" words appear ${youCount}× vs. "I/we" words ${selfCount}× (ratio ${ratio.toFixed(1)}). ${
          ratio >= 1.5
            ? "The copy keeps the client as the hero."
            : "Rewrite coach-centric passages so the client is the hero and the coach is the guide (aim for at least 1.5× more \"you\")."
        }`,
        `Le parole "tu" compaiono ${youCount} volte contro ${selfCount} di "io/noi" (rapporto ${ratio.toFixed(1)}). ${
          ratio >= 1.5
            ? "Il testo mantiene il cliente nel ruolo di eroe."
            : "Riscrivi i passaggi centrati sul coach perché il cliente sia l'eroe e il coach la guida (punta ad almeno 1,5 volte più \"tu\")."
        }`
      ),
      weight: 1,
      standard: STANDARDS.storybrand,
    });
  }

  // Urgency & scarcity.
  const urgency = firstMatch(bodyText, URGENCY);
  const countdown = COUNTDOWN_SIGNATURE.test(ctx.html);
  findings.push({
    id: "urgency",
    label: tr("Genuine urgency (cohort date / enrollment window)", "Urgenza reale (data di partenza / finestra di iscrizione)"),
    status: urgency ? "pass" : countdown ? "pass" : "warn",
    detail: urgency
      ? tr(
          `Urgency found ("${urgency}"). Real deadlines (cohort start, enrollment closing, limited seats) are standard in launch-style coaching funnels. Keep them truthful.`,
          `Urgenza presente ("${urgency}"). Scadenze reali (partenza dell'edizione, chiusura iscrizioni, posti limitati) sono la norma nei funnel di lancio. Mantienile veritiere.`
        )
      : countdown
      ? tr(
          "A countdown/timer script was detected. Make sure the deadline is real and visible near the CTA.",
          "Rilevato uno script di countdown/timer. Assicurati che la scadenza sia reale e visibile vicino alla CTA."
        )
      : tr(
          "No reason to act now: no cohort start date, enrollment deadline or seat limit. Without honest urgency many interested buyers postpone indefinitely.",
          "Nessun motivo per agire adesso: né data di partenza, né scadenza delle iscrizioni, né limite di posti. Senza un'urgenza onesta molti interessati rimandano all'infinito."
        ),
    weight: 2,
    standard: STANDARDS.cialdini,
  });

  // Low-commitment path.
  const leadMagnet = firstMatch(bodyText, LEAD_MAGNET);
  findings.push({
    id: "lead-path",
    label: tr("Low-commitment next step for not-ready visitors", "Passo a basso impegno per chi non è pronto"),
    status: leadMagnet ? "pass" : "info",
    detail: leadMagnet
      ? tr(
          `A lower-commitment entry point exists ("${leadMagnet}") so not-yet-ready visitors can still join your list.`,
          `Esiste un punto d'ingresso a basso impegno ("${leadMagnet}"), così chi non è ancora pronto può comunque entrare nella tua lista.`
        )
      : tr(
          "No free training, webinar, quiz or challenge offered as a secondary path. Optional, but most coaching funnels capture undecided visitors instead of losing them.",
          "Nessuna formazione gratuita, webinar, quiz o sfida come percorso alternativo. Facoltativo, ma la maggior parte dei funnel di coaching cattura gli indecisi invece di perderli."
        ),
    weight: 1,
    standard: STANDARDS.brunson,
  });

  return category(
    "framework",
    tr("Sales Page Structure", "Struttura della pagina di vendita"),
    tr(
      "Whether the page follows the proven coaching sales-page arc: outcome hook → avatar → pain → vision → coach story → objections → repeated CTA → urgency.",
      "Se la pagina segue l'arco collaudato delle pagine di vendita di coaching: aggancio sul risultato → avatar → dolore → visione → storia del coach → obiezioni → CTA ripetuta → urgenza."
    ),
    findings
  );
}
