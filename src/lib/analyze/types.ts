export type FindingStatus = "pass" | "warn" | "fail" | "info";

export interface Finding {
  id: string;
  label: string;
  status: FindingStatus;
  detail: string;
  weight: number;
  /** Optional itemized breakdown (e.g. each individual spelling error), shown
   * in the expanded category card. The top-recommendations list only ever
   * uses `detail`, so this doesn't affect that summary. */
  items?: string[];
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

export interface AnalysisReport {
  url: string;
  finalUrl: string;
  fetchedAt: string;
  overallScore: number;
  overallGrade: string;
  categories: CategoryResult[];
  topRecommendations: string[];
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
