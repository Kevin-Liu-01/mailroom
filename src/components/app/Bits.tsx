import { FitLine } from "@/components/landing/Section";
import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Brand, BRANDS, Person, type BrandId } from "@/components/landing/Brand";

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
        <div className="num text-[clamp(26px,2.6vw,34px)] leading-none">{value}</div>
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

/** An app page's opening: icon tile, a heading that always fits on one line, one line of facts under it, actions on the right. */
export function PageHead({ icon, title, mono = false, children, actions }: { icon: ReactNode; title: ReactNode; mono?: boolean; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <span className="tile tile--lg mt-0.5" aria-hidden="true">{icon}</span>
        <div className="min-w-0 flex-1">
          {typeof title === "string"
            ? <FitLine as="h1" text={title} voice={mono ? "mono" : "camber"} min={18} max={40} className="font-bold tracking-[-0.02em]" />
            : <h1 className={`m-0 whitespace-nowrap text-[clamp(22px,3vw,40px)] font-bold leading-[1.1] tracking-[-0.02em] ${mono ? "font-mono" : ""}`}>{title}</h1>}
          {children ? <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[13px] text-muted">{children}</div> : null}
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
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[11.5px] ${strong ? "text-ink" : "text-muted"}`} title={`${label}: ${p}%`}>
      <span className={strong ? "font-bold" : ""}>{label}</span>
      <span className="meter" style={{ width, height: strong ? 7 : 5 }}><i style={{ width: `${p}%` }} /></span>
      <span className={`tabular-nums ${strong ? "font-bold" : ""}`}>{p}%</span>
    </span>
  );
}

/** A horizontal distribution: labeled rows with bars that share one scale. */
export function Bars({ rows, max, tones }: { rows: { label: string; value: number; hint?: string }[]; max?: number; tones?: Tone[] }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="m-0 list-none space-y-1.5 p-0">
      {rows.map((r, i) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-2 font-mono text-[12.5px]">
          <span className="truncate" title={r.label}>{r.label}</span>
          <span className="meter" style={{ height: 8, "--tone": toneVar(tones?.[i] ?? "ink") } as CSSProperties}><i style={{ width: `${Math.max(2, (r.value / top) * 100)}%` }} /></span>
          <span className="tabular-nums text-muted">{r.hint ?? r.value}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---- Color, used sparingly ------------------------------------------------------------------ */
export type Tone = "ink" | "blue" | "green" | "amber" | "red" | "purple";
export const toneVar = (t: Tone): string => (t === "ink" ? "var(--ink)" : `var(--c-${t})`);
/** What each Jev signal means for the reader: red asks for action, amber for a decision, green and blue inform. */
export const SIGNAL_TONE: Record<string, Tone> = { needsReply: "red", urgency: "red", waiting: "amber", disposable: "amber", relevance: "blue", human: "green" };
export const CATEGORY_TONE: Record<string, Tone> = {
  work: "blue", personal: "green", finance: "purple", receipts: "amber", travel: "blue", events: "purple", recruiting: "blue", school: "amber",
  dev: "ink", social: "red", newsletters: "amber", marketing: "red", security: "green", other: "ink",
};

/** A probability as a labeled bar with its percentage, colored by what it means. */
export function TonedMeter({ value, label, tone = "ink", strong = false, width = 44 }: { value: number; label: string; tone?: Tone; strong?: boolean; width?: number }) {
  const p = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[11.5px] ${strong ? "text-ink" : "text-muted"}`} title={`${label}: ${p}%`} style={{ "--tone": toneVar(tone) } as CSSProperties}>
      <span className={strong ? "font-bold" : ""}>{label}</span>
      <span className="meter" style={{ width, height: strong ? 7 : 5 }}><i style={{ width: `${p}%` }} /></span>
      <span className={`tabular-nums ${strong ? "font-bold" : ""}`}>{p}%</span>
    </span>
  );
}

/** A small colored chip. */
export function TonedChip({ tone, children, className = "" }: { tone: Tone; children: ReactNode; className?: string }) {
  return <span className={`chip chip--tone ${className}`} style={{ "--tone": toneVar(tone) } as CSSProperties}>{children}</span>;
}

/** A category name in its color. */
export function CategoryChip({ id, label }: { id: string; label?: string }) {
  return <TonedChip tone={CATEGORY_TONE[id] ?? "ink"}>{label ?? id}</TonedChip>;
}

/** A section opening in the landing page's voice: a colored icon tile and a short display heading. */
export function SectionTitle({ icon: Icon, tone = "ink", children, action, sub }: { icon: LucideIcon; tone?: Tone; children: ReactNode; action?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className={`tile ${tone === "ink" ? "" : "tile--tone"}`} style={{ "--tone": toneVar(tone) } as CSSProperties} aria-hidden="true"><Icon size={20} strokeWidth={2.2} /></span>
        <div>
          <h2 className="m-0 text-[clamp(22px,2.4vw,28px)] font-bold leading-none tracking-[-0.02em]">{children}</h2>
          {sub ? <div className="mt-1 text-[13px] text-muted">{sub}</div> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ---- Senders --------------------------------------------------------------------------------- */
const DOMAIN_ALIASES: Record<string, BrandId> = {
  bankofamerica: "bofa", americanexpress: "amex", "1password": "onepassword", atlassian: "jira", instructure: "canvas", "lu": "luma", wellsfargo: "wellsfargo", nytimes: "nytimes", ubereats: "ubereats",
};
/** The brand mark for a sender domain when we have one. */
export function brandForDomain(domain: string): BrandId | null {
  const labels = domain.toLowerCase().split(".").filter((l) => l && !["com", "org", "net", "io", "co", "app", "ai", "dev", "so", "me", "us", "uk", "ca", "edu", "gov", "email", "mail", "news", "info", "em", "e", "notifications", "noreply", "no-reply", "hello", "support", "team", "reply"].includes(l));
  for (const l of labels) {
    if (l in DOMAIN_ALIASES) return DOMAIN_ALIASES[l];
    if (l in BRANDS) return l as BrandId;
  }
  return null;
}

/** A sender's mark: the brand in color when known, otherwise initials in a ring. */
export function SenderMark({ from, size = 18 }: { from: string; size?: number }) {
  const email = from.match(/<([^>]+)>/)?.[1] ?? from.trim();
  const domain = email.split("@")[1] ?? "";
  const name = from.replace(/<[^>]+>/, "").replace(/["']/g, "").trim() || email.split("@")[0];
  const brand = domain ? brandForDomain(domain) : null;
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
  return (
    <span className="tile tile--sm shrink-0" aria-hidden="true">
      {brand ? <Brand id={brand} size={size} /> : <Person initials={initials} size={size + 4} />}
    </span>
  );
}
