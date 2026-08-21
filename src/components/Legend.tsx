import { STATUS_STYLES } from "./statusStyles";

export function Legend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-400">
      {Object.values(STATUS_STYLES).map((style) => (
        <div key={style.label} className="flex items-center gap-1.5">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold ${style.text}`}
          >
            {style.icon}
          </span>
          <span>{style.label}</span>
        </div>
      ))}
    </div>
  );
}
