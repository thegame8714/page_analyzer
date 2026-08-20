"use client";

import { useState } from "react";
import { CategoryResult, FindingStatus } from "@/lib/analyze/types";
import { ScoreGauge } from "./ScoreGauge";

const STATUS_STYLES: Record<FindingStatus, { icon: string; text: string }> = {
  pass: { icon: "✓", text: "text-emerald-400" },
  warn: { icon: "!", text: "text-amber-400" },
  fail: { icon: "✕", text: "text-rose-400" },
  info: { icon: "i", text: "text-sky-400" },
};

export function CategoryCard({ category }: { category: CategoryResult }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 text-left"
      >
        <ScoreGauge score={category.score} size={72} strokeWidth={6} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-100">{category.name}</h3>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
              Grade {category.grade}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{category.summary}</p>
        </div>
        <span className="shrink-0 text-slate-500 text-xl select-none">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <ul className="mt-4 space-y-3 border-t border-slate-800 pt-4">
          {category.findings.map((f) => {
            const style = STATUS_STYLES[f.status];
            return (
              <li key={f.id} className="flex items-start gap-3 text-sm">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold ${style.text}`}
                >
                  {style.icon}
                </span>
                <div>
                  <p className="font-medium text-slate-200">{f.label}</p>
                  <p className="text-slate-400">{f.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
