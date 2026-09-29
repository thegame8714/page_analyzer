import { FindingStatus } from "@/lib/analyze/types";

export const STATUS_STYLES: Record<
  FindingStatus,
  { icon: string; text: string; labelKey: "statusPass" | "statusWarn" | "statusFail" | "statusInfo" }
> = {
  pass: { icon: "✓", text: "text-emerald-400", labelKey: "statusPass" },
  warn: { icon: "!", text: "text-amber-400", labelKey: "statusWarn" },
  fail: { icon: "✕", text: "text-rose-400", labelKey: "statusFail" },
  info: { icon: "i", text: "text-sky-400", labelKey: "statusInfo" },
};
