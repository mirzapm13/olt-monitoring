import type { AlertSeverity, OltStatus, Onu } from "@/lib/types"

type StatusBadgeProps = {
  value: OltStatus | Onu["status"] | AlertSeverity | Onu["syncStatus"]
}

const styles: Record<string, string> = {
  online: "border-emerald-200 bg-emerald-50 text-emerald-700",
  degraded: "border-amber-200 bg-amber-50 text-amber-700",
  offline: "border-slate-200 bg-slate-100 text-slate-600",
  los: "border-red-200 bg-red-50 text-red-700",
  critical: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  synced: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  "local-only": "border-slate-200 bg-slate-100 text-slate-600",
}

export function StatusBadge({ value }: StatusBadgeProps) {
  return (
    <span className={`inline-flex h-6 items-center rounded border px-2 text-xs font-medium ${styles[value]}`}>
      {value.replace("-", " ")}
    </span>
  )
}
