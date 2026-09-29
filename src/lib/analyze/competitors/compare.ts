import { AnalysisReport, Text } from "../types";

export interface Strength {
  /** `${categoryKey}:${findingId}`, stable across reports of the same product. */
  key: string;
  label: Text;
  category: Text;
}

/**
 * A site's best features: its passed checks, heaviest first. Categories come
 * back ordered by importance (conversion-driving ones first), so that order
 * breaks ties between equally weighted checks.
 */
export function topStrengths(report: AnalysisReport, count = 5): Strength[] {
  return report.categories
    .flatMap((c, categoryIndex) =>
      c.findings
        .filter((f) => f.status === "pass" && f.weight > 0)
        .map((f) => ({ key: `${c.key}:${f.id}`, label: f.label, category: c.name, weight: f.weight, categoryIndex }))
    )
    .sort((a, b) => b.weight - a.weight || a.categoryIndex - b.categoryIndex)
    .slice(0, count)
    .map(({ key, label, category }) => ({ key, label, category }));
}

/** Keys of every check a report passed, to spot strengths another site lacks. */
export function passedKeys(report: AnalysisReport): Set<string> {
  return new Set(
    report.categories.flatMap((c) => c.findings.filter((f) => f.status === "pass").map((f) => `${c.key}:${f.id}`))
  );
}

export interface RankedSite {
  name: string;
  url: string;
  isTarget: boolean;
  report: AnalysisReport;
}

/** Highest overall score first; the analyzed page wins ties. */
export function rankSites(sites: RankedSite[]): RankedSite[] {
  return [...sites].sort((a, b) => b.report.overallScore - a.report.overallScore || Number(b.isTarget) - Number(a.isTarget));
}

/** Category keys present in every compared report, in the target's order. */
export function sharedCategories(target: AnalysisReport, others: AnalysisReport[]): { key: string; name: Text }[] {
  return target.categories
    .filter((c) => others.every((o) => o.categories.some((oc) => oc.key === c.key)))
    .map((c) => ({ key: c.key, name: c.name }));
}

export function categoryScore(report: AnalysisReport, key: string): number | null {
  return report.categories.find((c) => c.key === key)?.score ?? null;
}
