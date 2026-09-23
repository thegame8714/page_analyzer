import { BlueprintSection } from "@/lib/analyze/types";
import { STATUS_STYLES } from "./statusStyles";

const CHIP_BORDER: Record<BlueprintSection["status"], string> = {
  pass: "border-emerald-800/70 bg-emerald-950/30",
  warn: "border-amber-800/70 bg-amber-950/30",
  fail: "border-rose-800/70 bg-rose-950/30",
  info: "border-sky-800/70 bg-sky-950/30",
};

export function Blueprint({ sections, title }: { sections: BlueprintSection[]; title: string }) {
  const present = sections.filter((s) => s.status === "pass").length;
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        <p className="text-sm text-slate-400">
          {present}/{sections.length} sections solid
        </p>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        The sections the leading pages of this funnel type share, in the order they usually appear.
      </p>
      <ol className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((s, i) => {
          const style = STATUS_STYLES[s.status];
          return (
            <li
              key={s.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${CHIP_BORDER[s.status]}`}
            >
              <span className="w-5 shrink-0 text-xs tabular-nums text-slate-500">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-slate-200">{s.label}</span>
              <span className={`shrink-0 text-xs font-bold ${style.text}`} aria-label={style.label}>
                {style.icon}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
