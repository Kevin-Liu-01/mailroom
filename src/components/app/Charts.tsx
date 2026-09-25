import type { MailboxStats } from "@/db/schema";
import { num } from "@/lib/format";

/** 14-day received volume as bars. Pure SVG, tokens for color. */
export function VolumeBars({ daily }: { daily: MailboxStats["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.received));
  const w = 280, h = 64, gap = 4, bw = (w - gap * (daily.length - 1)) / daily.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 16}`} width="100%" role="img" aria-label="Messages received per day, last 14 days">
      <defs><pattern id="bar-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="4" fill="var(--ink)" /></pattern></defs>
      {daily.map((d, i) => {
        const bh = Math.max(2, (d.received / max) * h);
        return <g key={d.date}><rect x={i * (bw + gap)} y={h - bh} width={bw} height={bh} fill={i === daily.length - 1 ? "var(--ink)" : "url(#bar-hatch)"} stroke="var(--ink)" strokeWidth=".8" /><title>{`${d.date}: ${d.received} received`}</title></g>;
      })}
      <text x="0" y={h + 13} fontSize="9" fill="var(--muted)">{daily[0]?.date.slice(5)}</text>
      <text x={w} y={h + 13} fontSize="9" fill="var(--muted)" textAnchor="end">today</text>
    </svg>
  );
}

/** Horizontal bars of taxonomy label sizes. */
export function LabelBars({ labels }: { labels: MailboxStats["labels"] }) {
  const rows = Object.entries(labels).filter(([, v]) => v.threads > 0).sort((a, b) => b[1].threads - a[1].threads).slice(0, 10);
  const max = Math.max(1, ...rows.map(([, v]) => v.threads));
  if (!rows.length) return <p className="text-sm text-muted">No labeled mail yet. Run the policy once.</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map(([name, v]) => (
        <li key={name} className="grid grid-cols-[140px_1fr_64px] items-center gap-2 text-[13px]">
          <span className="truncate">{name}</span>
          <div className="meter" style={{ height: 8 }}><i style={{ width: `${Math.max(2, (v.threads / max) * 100)}%` }} /></div>
          <span className="text-right text-muted">{num(v.threads)}{v.unread ? <span className="text-accent-deep"> · {num(v.unread)}</span> : null}</span>
        </li>
      ))}
    </ul>
  );
}

/** Inbox tabs as a stacked bar. */
export function TabStack({ tabs }: { tabs: MailboxStats["tabs"] }) {
  const order = ["Primary", "Promotions", "Updates", "Social", "Forums"];
  const total = order.reduce((n, k) => n + (tabs[k] ?? 0), 0) || 1;
  const shades = ["var(--ink)", "color-mix(in srgb, var(--ink) 65%, var(--page))", "color-mix(in srgb, var(--ink) 40%, var(--page))", "color-mix(in srgb, var(--ink) 22%, var(--page))", "color-mix(in srgb, var(--ink) 10%, var(--page))"];
  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden border border-ink bg-page">
        {order.map((k, i) => <div key={k} style={{ width: `${((tabs[k] ?? 0) / total) * 100}%`, background: shades[i] }} title={`${k}: ${tabs[k] ?? 0}`} />)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
        {order.map((k, i) => <span key={k} className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: shades[i] }} />{k} {num(tabs[k] ?? 0)}</span>)}
      </div>
    </div>
  );
}
