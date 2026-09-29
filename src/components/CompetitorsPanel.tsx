"use client";

import { AnalysisReport, Text } from "@/lib/analyze/types";
import type { CompetitorResult } from "@/lib/analyze/competitors";
import {
  RankedSite,
  categoryScore,
  passedKeys,
  rankSites,
  sharedCategories,
  topStrengths,
} from "@/lib/analyze/competitors/compare";
import { COMPETITORS_ENABLED } from "@/lib/features";
import { useLanguage } from "./LanguageProvider";
import { ScoreGauge } from "./ScoreGauge";

export type CompetitorsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: Text }
  | { status: "done"; competitors: CompetitorResult[] };

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function CompetitorsPanel({
  target,
  state,
  onRequest,
}: {
  target: AnalysisReport;
  state: CompetitorsState;
  /** Starts the (paid, 1-3 minute) competitor research — only on demand. */
  onRequest: () => void;
}) {
  const { t, p } = useLanguage();
  const disabled = !COMPETITORS_ENABLED;

  return (
    <section
      className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-6 ${disabled ? "select-none opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-100">{t.competitorsTitle}</h2>
        {disabled && (
          <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-400">{t.comingSoon}</span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-400">{t.competitorsSubtitle}</p>

      {(state.status === "idle" || state.status === "error") && (
        <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onRequest}
            disabled={disabled}
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {t.competitorsRequest}
          </button>
          {state.status === "idle" && <p className="text-sm text-slate-400">{t.competitorsIdle}</p>}
        </div>
      )}

      {state.status === "loading" && (
        <div className="mt-6 flex items-center gap-3 text-sm text-slate-400">
          <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
          {t.competitorsLoading}
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-4 rounded-xl border border-rose-800 bg-rose-950/50 px-4 py-3 text-sm text-rose-300">{p(state.error)}</div>
      )}

      {state.status === "done" && <Comparison target={target} competitors={state.competitors} />}
    </section>
  );
}

function Comparison({ target, competitors }: { target: AnalysisReport; competitors: CompetitorResult[] }) {
  const { t, p } = useLanguage();
  const targetSite: RankedSite = { name: t.yourPage, url: target.finalUrl, isTarget: true, report: target };
  const analyzed: RankedSite[] = competitors.flatMap((c) =>
    c.report ? [{ name: c.name, url: c.report.finalUrl, isTarget: false, report: c.report }] : []
  );
  const ranked = rankSites([targetSite, ...analyzed]);
  const categories = sharedCategories(target, analyzed.map((s) => s.report));
  const targetPassed = passedKeys(target);
  const failed = competitors.filter((c) => !c.report);
  const reasonFor = (url: string) => competitors.find((c) => c.report?.finalUrl === url)?.reason;

  return (
    <div className="mt-6 space-y-8">
      {/* Ranking */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t.ranking}</h3>
        <ol className="mt-3 space-y-2">
          {ranked.map((site, i) => {
            const reason = site.isTarget ? undefined : reasonFor(site.url);
            return (
              <li
                key={site.url}
                className={`flex items-center gap-4 rounded-xl border p-3 ${
                  site.isTarget ? "border-emerald-700 bg-emerald-950/30" : "border-slate-800 bg-slate-950/40"
                }`}
              >
                <span className="w-6 shrink-0 text-center text-lg font-bold tabular-nums text-slate-300">{i + 1}</span>
                <ScoreGauge score={site.report.overallScore} size={52} strokeWidth={5} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-100">
                    {site.name}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {t.grade} {site.report.overallGrade}
                    </span>
                  </p>
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-emerald-400 hover:underline"
                  >
                    {site.url}
                  </a>
                  {reason && <p className="mt-1 text-xs text-slate-400">{p(reason)}</p>}
                </div>
              </li>
            );
          })}
        </ol>
        {failed.map((c) => (
          <p key={c.url} className="mt-2 text-xs text-slate-500">
            {c.name} ({hostname(c.url)}): {t.notAnalyzed}. {c.error ? p(c.error) : ""}
          </p>
        ))}
      </div>

      {/* Category comparison */}
      {analyzed.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t.categoryComparison}</h3>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-400">
                  <th className="px-3 py-2 font-medium">{t.categoryColumn}</th>
                  {ranked.map((site) => (
                    <th
                      key={site.url}
                      className={`px-3 py-2 text-right font-medium ${site.isTarget ? "text-emerald-300" : ""}`}
                      title={site.url}
                    >
                      {site.isTarget ? t.yourPage : site.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[{ key: "__overall", name: t.overall as Text }, ...categories].map((cat) => {
                  const scores = ranked.map((site) =>
                    cat.key === "__overall" ? site.report.overallScore : categoryScore(site.report, cat.key)
                  );
                  const best = Math.max(...scores.map((s) => s ?? -1));
                  return (
                    <tr key={cat.key} className="border-b border-slate-800/60 last:border-0">
                      <td className={`px-3 py-2 text-slate-300 ${cat.key === "__overall" ? "font-semibold" : ""}`}>{p(cat.name)}</td>
                      {scores.map((score, i) => (
                        <td
                          key={ranked[i].url}
                          className={`px-3 py-2 text-right tabular-nums ${ranked[i].isTarget ? "bg-emerald-950/20" : ""} ${
                            score === best ? "font-bold text-emerald-400" : "text-slate-400"
                          }`}
                        >
                          {score ?? "–"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top strengths */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t.topStrengths}</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ranked.map((site) => {
            const strengths = topStrengths(site.report);
            return (
              <div
                key={site.url}
                className={`rounded-xl border p-4 ${site.isTarget ? "border-emerald-700 bg-emerald-950/20" : "border-slate-800 bg-slate-950/40"}`}
              >
                <p className="font-medium text-slate-100">{site.name}</p>
                <p className="truncate text-xs text-slate-500">{hostname(site.url)}</p>
                {strengths.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">{t.noStrengths}</p>
                ) : (
                  <ol className="mt-3 space-y-1.5 text-sm">
                    {strengths.map((s) => (
                      <li key={s.key} className="flex items-start gap-2">
                        <span className="mt-0.5 text-emerald-400">✓</span>
                        <span className="min-w-0 text-slate-300">
                          {p(s.label)}
                          <span className="ml-1 text-xs text-slate-500">· {p(s.category)}</span>
                          {!site.isTarget && !targetPassed.has(s.key) && (
                            <span className="ml-2 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                              {t.youLackThis}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
