"use client";

import { FunnelInfo } from "@/lib/analyze/types";
import { REFERENCE_FUNNELS } from "@/lib/analyze/coaching/referenceFunnels";
import { useLanguage } from "./LanguageProvider";

export function FunnelFlow({ funnel }: { funnel: FunnelInfo }) {
  const { t, p } = useLanguage();
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-100">{t.funnelFlow}</h2>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
          {funnel.type === "call" ? t.funnelCall : t.funnelCheckout}
        </span>
        <span className="text-xs text-slate-500">{funnel.detected ? t.autoDetected : t.chosenByYou}</span>
      </div>
      <p className="mt-1 text-sm text-slate-400">{p(funnel.reason)}</p>

      <ol className="mt-4 flex flex-col gap-2 md:flex-row md:items-stretch">
        {funnel.steps.map((step, i) => (
          <li key={i} className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
            {i > 0 && (
              <span aria-hidden className="self-center text-slate-600 md:px-1">
                <span className="md:hidden">↓</span>
                <span className="hidden md:inline">→</span>
              </span>
            )}
            <div className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm">
              <p className="text-xs text-slate-500">
                {t.step} {i + 1}
              </p>
              <p className="font-medium text-slate-200">{p(step.label)}</p>
              {step.url && (
                <a
                  href={step.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs text-emerald-400 hover:underline"
                >
                  {step.url}
                </a>
              )}
              {step.notes.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
                  {step.notes.map((n, j) => (
                    <li key={j}>{p(n)}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>

      {funnel.type === "call" && (
        <details className="mt-5 group">
          <summary className="cursor-pointer text-sm font-medium text-slate-300 hover:text-slate-100">
            {t.leadersTitle}
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {REFERENCE_FUNNELS.map((r) => (
              <div key={r.name} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-200 hover:underline">
                  {r.name} ↗
                </a>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-400">
                  {r.steps.map((s, i) => (
                    <li key={i}>{p(s)}</li>
                  ))}
                </ol>
                <p className="mt-2 text-xs text-slate-300">
                  <span className="text-emerald-400">{t.borrow}</span> {p(r.borrow)}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
