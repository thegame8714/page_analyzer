# Coaching Sales Page Analyzer

Paste the URL of an online coaching program's sales page and get a scored audit
of everything that affects its ability to convert, benchmarked against the
standards the top coaching sales pages follow.

```bash
npm install
npm run dev   # http://localhost:3000
```

## Funnel types

The analyzer auto-detects (or you choose) which funnel the page runs, then
follows the main CTA to the next step:

- **Direct purchase** (e.g. B-School): if the CTA opens a separate
  enrollment page, that page's content is merged into the Offer / Structure /
  Trust analysis, and the checkout hop is shown.
- **Free call / application** (Tony Robbins Results Coaching, Clients on
  Demand, Jay Shetty Certification, Consulting.com): adds a **Free-Call
  Funnel** category covering the call invitation (named, free, length,
  takeaway, who you'll speak to, no-pressure, scarcity, how it works, price
  question, CTA copy). It also audits the booking step: clicks to book, form
  and/or calendar, qualifying and budget questions, form friction, proof on
  the booking page, consent. Price, stack and bonus checks are skipped because
  those are presented on the call. See
  `src/lib/analyze/coaching/referenceFunnels.ts` for the reference flows.

## What it checks

| Category | Weight | Benchmarked against |
|---|---|---|
| **Free-Call Funnel** (call funnels only) | 1.4 | Robbins · Ruffino · Shetty · Ovens, StoryBrand, Cialdini |
| **Offer Strength**: time-to-result, delivery format, curriculum, value stack, bonuses, price/application, payment plan, guarantee | 1.4 | Hormozi *$100M Offers* (Value Equation), Brunson |
| **Sales Page Structure**: outcome headline, avatar callout, "not for you", pain, vision, coach story, FAQ/objections, CTA repetition & copy, you-focus, urgency, lead magnet | 1.3 | Brunson *Expert Secrets*, StoryBrand SB7, PAS/AIDA |
| **Trust & Proof**: testimonial volume, result-specific proof, video, faces/names, credentials, media, ratings, earnings disclaimer, hype, legal pages, business identity (P.IVA) | 1.3 | Cialdini, Google E-E-A-T, FTC Endorsement Guides & Fake Reviews Rule, EU consumer law |
| **Conversion UX**: above-fold CTA, checkout/booking path, mobile, page weight, tracking pixels, chat/WhatsApp, tech stack | 1.0 | Core Web Vitals, CRO best practice |
| Text Clarity · SEO · GEO (AI search) · Content Efficiency · Grammar (LanguageTool) | 0.7–0.9 | Flesch/Gulpease, Google Search Essentials, GEO |

The report also shows a **16-section blueprint** (the canonical coaching
sales-page arc, in order) with which sections were detected.

Copy checks run in English and Italian, with partial Spanish, French, German
and Portuguese support.

## Layout

- `src/lib/analyze/coaching/`: coaching-specific checks (`offer.ts`,
  `framework.ts`, `trust.ts`), keyword patterns (`patterns.ts`), standards
  labels (`standards.ts`) and shared page context (`context.ts`).
- `src/lib/analyze/*.ts`: generic checks shared with the Landing Page
  Analyzer (SEO, GEO, clarity, efficiency, grammar) plus `conversion.ts`
  (Conversion UX).
- `src/lib/analyze/index.ts`: orchestration, category weights, blueprint and
  top recommendations.

## Limitations

Analysis runs on the server-rendered HTML. Content injected purely client-side,
or tags loaded only after cookie consent, won't be seen. Checks are
keyword/structure heuristics, not an LLM reading the page.
