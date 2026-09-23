// How the best-known free-call coaching funnels are built, as observed on
// their live sites (September 2026). Shown next to a call-funnel report so the
// user can compare their flow to the leaders'.
export interface ReferenceFunnel {
  name: string;
  url: string;
  steps: string[];
  borrow: string;
}

export const REFERENCE_FUNNELS: ReferenceFunnel[] = [
  {
    name: "Tony Robbins · Results Coaching",
    url: "https://www.tonyrobbins.com/results-coaching",
    steps: ["Benefit-led page + testimonials + 10 FAQs", "\"Get a free 30-minute strategy session\"", "Pop-up form → Calendly on /start"],
    borrow: "Name the call, state it's free and how long it lasts, and answer \"can I try it before committing?\" in the FAQ.",
  },
  {
    name: "Clients on Demand · Russ Ruffino",
    url: "https://www.clientsondemand.com/",
    steps: ["Pain → \"Hi, I'm Russ\" → wall of results", "\"Book a free strategy call… we'll map out a step-by-step plan\"", "Application form + calendar, with testimonials under it"],
    borrow: "Promise a concrete takeaway from the call and keep the proof going on the application page itself.",
  },
  {
    name: "Jay Shetty Certification School",
    url: "https://jayshettycoaching.com/",
    steps: ["4-step \"how it works\" + FAQ incl. \"How much does it cost?\"", "\"Book a Call\" / \"Speak with an Enrollment Advisor\" (+ quiz for undecided visitors)", "3-step form: contact → \"What best describes your financial situation?\" → calendar"],
    borrow: "Collect contact details first, then qualify on budget before showing the calendar. Offer a quiz to people not ready to book.",
  },
  {
    name: "Consulting.com · Sam Ovens",
    url: "https://www.consulting.com/",
    steps: ["Long-form page, \"Apply Now\" CTAs", "Dedicated assessment-call page", "Tally form + cal.com calendar on one short page"],
    borrow: "Keep the booking page short and single-purpose: form and calendar together, nothing else to click.",
  },
];
