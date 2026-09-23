"use client";

import { useState } from "react";
import { CategoryResult } from "@/lib/analyze/types";
import { ScoreGauge } from "./ScoreGauge";
import { STATUS_STYLES } from "./statusStyles";

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
                <div className="min-w-0">
                  <p className="font-medium text-slate-200">
                    {f.label}
                    {f.standard && (
                      <span className="ml-2 inline-block rounded-full border border-slate-700 px-2 py-0.5 align-middle text-[10px] font-normal text-slate-400">
                        {f.standard}
                      </span>
                    )}
                  </p>
                  <p className="text-slate-400">{f.detail}</p>
                  {f.items && f.items.length > 0 && (
                    <ul className="mt-2 space-y-1 rounded-lg bg-slate-950/60 p-3 text-xs text-slate-400">
                      {f.items.map((item, i) => (
                        <li key={i} className="break-words">
                          {item.text}
                          {item.href && (
                            <a
                              href={item.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-1.5 whitespace-nowrap text-emerald-400 hover:text-emerald-300 hover:underline"
                            >
                              Open ↗
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
