import { tr } from "../types";

// The published frameworks that the best-converting online coaching sales
// pages are built on. Each finding is tagged with the one it's benchmarked
// against, so a failing check points the reader at where the practice comes from.
export const STANDARDS = {
  hormozi: tr("Hormozi · $100M Offers (Value Equation)", "Hormozi · $100M Offers (Value Equation)"),
  brunson: tr("Brunson · Expert Secrets / DotCom Secrets", "Brunson · Expert Secrets / DotCom Secrets"),
  storybrand: tr("Miller · StoryBrand SB7", "Miller · StoryBrand SB7"),
  copywriting: tr("Direct-response copywriting (PAS / AIDA)", "Copywriting a risposta diretta (PAS / AIDA)"),
  cialdini: tr("Cialdini · Influence (proof, authority, scarcity)", "Cialdini · Le armi della persuasione (riprova sociale, autorità, scarsità)"),
  ftc: tr("FTC · Endorsement Guides (2023) & Fake Reviews Rule (2024)", "FTC · Endorsement Guides (2023) e norma sulle recensioni false (2024)"),
  euConsumer: tr("EU · Omnibus Directive & Consumer Rights", "UE · Direttiva Omnibus e diritti dei consumatori"),
  eeat: tr("Google · E-E-A-T / Helpful Content", "Google · E-E-A-T / Helpful Content"),
  cwv: tr("Google · Core Web Vitals / CRO benchmarks", "Google · Core Web Vitals / benchmark CRO"),
  cro: tr("CRO best practice (Unbounce / CXL)", "Best practice CRO (Unbounce / CXL)"),
  geo: tr("Generative Engine Optimization", "Generative Engine Optimization"),
  callFunnel: tr(
    "Free-call funnel leaders (Robbins · Ruffino · Shetty · Ovens)",
    "Leader dei funnel a call gratuita (Robbins · Ruffino · Shetty · Ovens)"
  ),
  searchEssentials: tr("Google · Search Essentials", "Google · Search Essentials"),
} as const;
