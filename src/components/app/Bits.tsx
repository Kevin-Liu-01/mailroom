import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** A card's title row: icon tile, name, and an optional action on the right. */
export function CardTitle({ icon: Icon, children, action }: { icon: LucideIcon; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="m-0 flex items-center gap-2.5 text-[15px] font-bold tracking-normal">
        <span className="tile tile--sm" aria-hidden="true"><Icon size={16} strokeWidth={2.2} /></span>
        {children}
      </h2>
      {action}
    </div>
  );
}

/** One number with a name under it. */
export function Stat({ icon: Icon, value, label, hint }: { icon: LucideIcon; value: ReactNode; label: string; hint?: ReactNode }) {
  return (
    <div className="card flex items-start gap-4 py-5">
      <span className="tile" aria-hidden="true"><Icon size={20} strokeWidth={2.2} /></span>
      <div className="min-w-0">
        <div className="display text-[clamp(26px,2.6vw,34px)] leading-none">{value}</div>
        <div className="mt-2 text-[13px] text-muted">{label}</div>
        {hint ? <div className="mt-0.5 text-[12px] text-muted">{hint}</div> : null}
      </div>
    </div>
  );
}

/** An empty state: an icon, one line, an optional action. */
export function Empty({ icon: Icon, children, action }: { icon: LucideIcon; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-wrap items-center gap-4 text-[14px] text-muted">
      <span className="tile tile--sm" aria-hidden="true"><Icon size={16} /></span>
      <p className="m-0 min-w-0 flex-1">{children}</p>
      {action}
    </div>
  );
}

/** An app page's opening: icon tile, a heading that never runs past two lines, one line of facts under it, actions on the right. */
export function PageHead({ icon, title, children, actions }: { icon: ReactNode; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6">
      <div className="flex min-w-0 items-start gap-4">
        <span className="tile tile--lg mt-0.5" aria-hidden="true">{icon}</span>
        <div className="min-w-0">
          <h1 className="m-0 text-[clamp(26px,3vw,40px)] font-bold leading-[1.1] tracking-[-0.02em] [overflow-wrap:anywhere]">{title}</h1>
          {children ? <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13.5px] text-muted">{children}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A small fact with an icon, for the line under a page title. */
export function Meta({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5"><Icon size={14} aria-hidden="true" />{children}</span>;
}

/** A probability as a labeled bar with its percentage. `strong` marks the signal the question was about. */
export function Meter({ value, label, strong = false, width = 44 }: { value: number; label: string; strong?: boolean; width?: number }) {
  const p = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] ${strong ? "text-ink" : "text-muted"}`} title={`${label}: ${p}%`}>
      <span className={strong ? "font-bold" : ""}>{label}</span>
      <span className="meter" style={{ width, height: strong ? 7 : 5 }}><i style={{ width: `${p}%` }} /></span>
      <span className={`tabular-nums ${strong ? "font-bold" : ""}`}>{p}%</span>
    </span>
  );
}

/** A horizontal distribution: labeled rows with bars that share one scale. */
export function Bars({ rows, max }: { rows: { label: string; value: number; hint?: string }[]; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="m-0 list-none space-y-1.5 p-0">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-2 text-[12.5px]">
          <span className="truncate" title={r.label}>{r.label}</span>
          <span className="meter" style={{ height: 8 }}><i style={{ width: `${Math.max(2, (r.value / top) * 100)}%` }} /></span>
          <span className="tabular-nums text-muted">{r.hint ?? r.value}</span>
        </li>
      ))}
    </ul>
  );
}
