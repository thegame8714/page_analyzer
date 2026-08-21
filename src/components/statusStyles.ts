import { FindingStatus } from "@/lib/analyze/types";

export const STATUS_STYLES: Record<FindingStatus, { icon: string; text: string; label: string }> = {
  pass: { icon: "✓", text: "text-emerald-400", label: "Pass" },
  warn: { icon: "!", text: "text-amber-400", label: "Needs attention" },
  fail: { icon: "✕", text: "text-rose-400", label: "Fail" },
  info: { icon: "i", text: "text-sky-400", label: "Informational" },
};
