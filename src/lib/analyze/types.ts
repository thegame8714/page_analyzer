export type FindingStatus = "pass" | "warn" | "fail" | "info";

export interface FindingItem {
  text: string;
  /** Deep link to where this item appears on the live page, e.g. a Text
   * Fragment URL (`#:~:text=...`) that scrolls to and highlights it. */
  href?: string;
}

export interface Finding {
  id: string;
  label: string;
  status: FindingStatus;
  detail: string;
  weight: number;
  /** The industry standard / framework this check is benchmarked against
   * (e.g. "Hormozi · Value Equation"), shown as a tag next to the finding. */
  standard?: string;
  /** Optional itemized breakdown (e.g. each individual spelling error), shown
   * in the expanded category card. The top-recommendations list only ever
   * uses `detail`, so this doesn't affect that summary. */
  items?: FindingItem[];
}

export interface CategoryResult {
  key: string;
  name: string;
  score: number;
  grade: string;
  summary: string;
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
  label: string;
  status: FindingStatus;
}

/** "call": the page sells a free call/application (price revealed on the
 * call). "checkout": the page sells the program directly online. */
export type FunnelType = "call" | "checkout";
export type FunnelMode = FunnelType | "auto";

export interface FunnelStep {
  label: string;
  url?: string;
  /** page = a fetched HTML page; embedded = booking widget on the same page;
   * scheduler / checkout / form = hosted third-party tool (not inspectable);
   * unknown = couldn't be resolved. */
  kind: "page" | "embedded" | "scheduler" | "checkout" | "form" | "unknown";
  notes: string[];
}

export interface FunnelInfo {
  type: FunnelType;
  /** True when the type was auto-detected rather than chosen by the user. */
  detected: boolean;
  reason: string;
  steps: FunnelStep[];
}

export interface AnalysisReport {
  url: string;
  finalUrl: string;
  fetchedAt: string;
  overallScore: number;
  overallGrade: string;
  categories: CategoryResult[];
  topRecommendations: string[];
  /** The canonical coaching sales-page sections, in the order top coaching
   * sales pages present them, with whether each was detected. */
  blueprint: BlueprintSection[];
  funnel: FunnelInfo;
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
