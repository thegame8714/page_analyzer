export type FindingStatus = "pass" | "warn" | "fail" | "info";

export type Lang = "en" | "it";

/** Report copy in every supported UI language. The server fills in both, so
 * the page can switch language instantly without re-running the analysis. */
export type LocalizedText = Record<Lang, string>;

/** A plain string is language-neutral data (a URL, a quote from the page, a
 * LanguageTool message); a LocalizedText is copy written by the analyzer. */
export type Text = string | LocalizedText;

export function tr(en: string, it: string): LocalizedText {
  return { en, it };
}

export function pick(text: Text, lang: Lang): string {
  return typeof text === "string" ? text : text[lang];
}

/** Which analysis to run: a general landing page, or an online coaching
 * program's sales / free-call page. */
export type Product = "landing" | "coaching";

export interface FindingItem {
  text: Text;
  /** Deep link to where this item appears on the live page, e.g. a Text
   * Fragment URL (`#:~:text=...`) that scrolls to and highlights it. */
  href?: string;
}

export interface Finding {
  id: string;
  label: Text;
  status: FindingStatus;
  detail: Text;
  weight: number;
  /** The industry standard / framework this check is benchmarked against
   * (e.g. "Hormozi · Value Equation"), shown as a tag next to the finding. */
  standard?: Text;
  /** Optional itemized breakdown (e.g. each individual spelling error), shown
   * in the expanded category card. The top-recommendations list only ever
   * uses `detail`, so this doesn't affect that summary. */
  items?: FindingItem[];
}

export interface CategoryResult {
  key: string;
  name: Text;
  score: number;
  grade: string;
  summary: Text;
  findings: Finding[];
}

export interface PageData {
  url: string;
  finalUrl: string;
  status: number;
  html: string;
  fetchMs: number;
  sizeBytes: number;
}

export interface BlueprintSection {
  id: string;
  label: Text;
  status: FindingStatus;
}

/** "call": the page sells a free call/application (price revealed on the
 * call). "checkout": the page sells the program directly online. */
export type FunnelType = "call" | "checkout";
export type FunnelMode = FunnelType | "auto";

export interface FunnelStep {
  label: Text;
  url?: string;
  /** page = a fetched HTML page; embedded = booking widget on the same page;
   * scheduler / checkout / form = hosted third-party tool (not inspectable);
   * unknown = couldn't be resolved. */
  kind: "page" | "embedded" | "scheduler" | "checkout" | "form" | "unknown";
  notes: Text[];
}

export interface FunnelInfo {
  type: FunnelType;
  /** True when the type was auto-detected rather than chosen by the user. */
  detected: boolean;
  reason: Text;
  steps: FunnelStep[];
}

export interface Recommendation {
  category: Text;
  detail: Text;
}

export interface AnalysisReport {
  product: Product;
  url: string;
  finalUrl: string;
  fetchedAt: string;
  overallScore: number;
  overallGrade: string;
  categories: CategoryResult[];
  topRecommendations: Recommendation[];
  /** Coaching only: the canonical sections of the detected funnel type, in
   * the order the leading pages present them, with whether each was found. */
  blueprint?: BlueprintSection[];
  /** Coaching only: detected funnel type and the steps followed from the CTA. */
  funnel?: FunnelInfo;
}

export function scoreFromFindings(findings: Finding[]): number {
  const totalWeight = findings.reduce((sum, f) => sum + f.weight, 0);
  if (totalWeight === 0) return 100;
  const earned = findings.reduce((sum, f) => {
    if (f.status === "pass") return sum + f.weight;
    if (f.status === "warn") return sum + f.weight * 0.5;
    if (f.status === "info") return sum + f.weight;
    return sum;
  }, 0);
  return Math.round((earned / totalWeight) * 100);
}

export function gradeFromScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
