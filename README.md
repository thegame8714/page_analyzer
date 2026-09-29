# Conversion Analyzer

Paste a URL and get a scored audit of everything that affects the page's
ability to convert. Two analysis types:

- **Landing page**: the original Landing Page Analyzer (conversion
  readiness, SEO, GEO, text clarity, content efficiency, grammar).
- **Evergreen**: an online coaching program's sales or free-call page,
  benchmarked against the standards the leading coaching businesses follow
  (see below).

The interface and the whole report can be shown in **English or Italian**
(toggle in the header, remembered per browser). The API returns every report
text in both languages (`{ en, it }`), so switching never re-runs the
analysis. Quotes from the analyzed page and LanguageTool's grammar messages
stay in the page's own language.

```bash
npm install
npm run dev   # http://localhost:3000
```

## Funnel types (Evergreen)

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

- `src/lib/analyze/types.ts`: report types, plus `tr(en, it)` / `pick()` for
  bilingual report text. `src/lib/i18n.ts` holds the interface strings and
  `src/components/LanguageProvider.tsx` the language toggle.
- `src/lib/analyze/landing/conversion.ts`: the Landing page conversion check.
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
