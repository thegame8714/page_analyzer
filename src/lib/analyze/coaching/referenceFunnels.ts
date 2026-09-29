import { LocalizedText, tr } from "../types";

// How the best-known free-call coaching funnels are built, as observed on
// their live sites (September 2026). Shown next to a call-funnel report so the
// user can compare their flow to the leaders'.
export interface ReferenceFunnel {
  name: string;
  url: string;
  steps: LocalizedText[];
  borrow: LocalizedText;
}

export const REFERENCE_FUNNELS: ReferenceFunnel[] = [
  {
    name: "Tony Robbins · Results Coaching",
    url: "https://www.tonyrobbins.com/results-coaching",
    steps: [
      tr("Benefit-led page + testimonials + 10 FAQs", "Pagina sui benefici + testimonianze + 10 FAQ"),
      tr("\"Get a free 30-minute strategy session\"", "\"Ottieni una sessione strategica gratuita di 30 minuti\""),
      tr("Pop-up form → Calendly on /start", "Form in pop-up → Calendly su /start"),
    ],
    borrow: tr(
      "Name the call, state it's free and how long it lasts, and answer \"can I try it before committing?\" in the FAQ.",
      "Dai un nome alla call, di' che è gratuita e quanto dura, e rispondi a \"posso provare prima di impegnarmi?\" nelle FAQ."
    ),
  },
  {
    name: "Clients on Demand · Russ Ruffino",
    url: "https://www.clientsondemand.com/",
    steps: [
      tr("Pain → \"Hi, I'm Russ\" → wall of results", "Dolore → \"Ciao, sono Russ\" → muro di risultati"),
      tr(
        "\"Book a free strategy call… we'll map out a step-by-step plan\"",
        "\"Prenota una call strategica gratuita… definiremo un piano passo passo\""
      ),
      tr("Application form + calendar, with testimonials under it", "Form di candidatura + calendario, con le testimonianze sotto"),
    ],
    borrow: tr(
      "Promise a concrete takeaway from the call and keep the proof going on the application page itself.",
      "Prometti un risultato concreto dalla call e continua a mostrare prove anche nella pagina di candidatura."
    ),
  },
  {
    name: "Jay Shetty Certification School",
    url: "https://jayshettycoaching.com/",
    steps: [
      tr("4-step \"how it works\" + FAQ incl. \"How much does it cost?\"", "\"Come funziona\" in 4 passi + FAQ con \"Quanto costa?\""),
      tr(
        "\"Book a Call\" / \"Speak with an Enrollment Advisor\" (+ quiz for undecided visitors)",
        "\"Prenota una call\" / \"Parla con un consulente\" (+ quiz per gli indecisi)"
      ),
      tr(
        "3-step form: contact → \"What best describes your financial situation?\" → calendar",
        "Form in 3 passi: contatti → \"Cosa descrive meglio la tua situazione finanziaria?\" → calendario"
      ),
    ],
    borrow: tr(
      "Collect contact details first, then qualify on budget before showing the calendar. Offer a quiz to people not ready to book.",
      "Raccogli prima i contatti, poi qualifica sul budget prima di mostrare il calendario. Offri un quiz a chi non è pronto a prenotare."
    ),
  },
  {
    name: "Consulting.com · Sam Ovens",
    url: "https://www.consulting.com/",
    steps: [
      tr("Long-form page, \"Apply Now\" CTAs", "Pagina lunga, CTA \"Candidati ora\""),
      tr("Dedicated assessment-call page", "Pagina dedicata alla call di valutazione"),
      tr("Tally form + cal.com calendar on one short page", "Form Tally + calendario cal.com su una pagina breve"),
    ],
    borrow: tr(
      "Keep the booking page short and single-purpose: form and calendar together, nothing else to click.",
      "Tieni la pagina di prenotazione breve e con un solo scopo: form e calendario insieme, nient'altro da cliccare."
    ),
  },
];
