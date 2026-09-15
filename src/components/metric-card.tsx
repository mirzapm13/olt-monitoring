type MetricCardProps = {
  label: string
  value: string
  detail: string
  tone?: "cyan" | "emerald" | "amber" | "red"
}

const toneStyles = {
  cyan: {
    line: "from-cyan-400 via-sky-400 to-cyan-200",
    glow: "bg-cyan-400/20",
    dot: "bg-cyan-400",
    ring: "border-cyan-300/30 bg-cyan-400/10 text-cyan-600",
  },
  emerald: {
    line: "from-emerald-400 via-lime-300 to-cyan-300",
    glow: "bg-emerald-400/20",
    dot: "bg-emerald-400",
    ring: "border-emerald-300/30 bg-emerald-400/10 text-emerald-600",
  },
  amber: {
    line: "from-amber-400 via-orange-300 to-yellow-200",
    glow: "bg-amber-400/20",
    dot: "bg-amber-400",
    ring: "border-amber-300/30 bg-amber-400/10 text-amber-600",
  },
  red: {
    line: "from-red-400 via-rose-400 to-orange-300",
    glow: "bg-red-400/20",
    dot: "bg-red-400",
    ring: "border-red-300/30 bg-red-400/10 text-red-600",
  },
}

export function MetricCard({ label, value, detail, tone = "cyan" }: MetricCardProps) {
  const styles = toneStyles[tone]

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${styles.line}`} />
      <div className={`absolute -right-8 -top-10 h-28 w-28 rounded-full ${styles.glow} blur-3xl transition group-hover:scale-125`} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
          <p className="mt-2 text-sm text-slate-500">{detail}</p>
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${styles.ring}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${styles.dot} shadow-[0_0_18px_currentColor]`} />
        </div>
      </div>
    </article>
  )
}
