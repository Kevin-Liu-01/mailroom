import { Check, Landmark, Shield, Trash2, Undo2, type LucideIcon } from "lucide-react";
import { Brand, Person, type BrandId } from "./Brand";

/*
 * The Senders table, four rows of it: who sends, how much, how much of it you open, what Jev thinks,
 * and the verdict you click. Trash is one verdict among three, never the default look.
 */
type Verdict = "trash" | "keep" | "protect";
type Row = { mark: BrandId | { initials: string }; name: string; domain: string; kind: string; messages: number; unread: number; disposable: number; verdict: Verdict };

const ROWS: Row[] = [
  { mark: "target", name: "Target", domain: "em.target.com", kind: "Promotions, three a week", messages: 214, unread: 1, disposable: 0.96, verdict: "trash" },
  { mark: "linkedin", name: "LinkedIn", domain: "news.linkedin.com", kind: "Social digests", messages: 168, unread: 0.97, disposable: 0.91, verdict: "trash" },
  { mark: "chase", name: "Chase", domain: "chase.com", kind: "Statements and alerts", messages: 42, unread: 0.12, disposable: 0.08, verdict: "keep" },
  { mark: { initials: "MK" }, name: "Maria K.", domain: "maria.k@gmail.com", kind: "A person who writes to you", messages: 19, unread: 0, disposable: 0.02, verdict: "protect" },
];

const VERDICTS: Record<Verdict, { label: string; icon: LucideIcon }> = {
  trash: { label: "trash after 30d", icon: Trash2 },
  keep: { label: "keep: records", icon: Landmark },
  protect: { label: "protect", icon: Shield },
};

const total = ROWS.reduce((n, r) => n + r.messages, 0);
const reclaimable = ROWS.filter((r) => r.verdict === "trash").reduce((n, r) => n + r.messages, 0);
const rules = ROWS.filter((r) => r.verdict === "trash").length;
const pct = (n: number) => `${Math.round(n * 100)}%`;

// One template for the header row and every sender row, so the columns line up like a table.
const COLS = "md:grid-cols-[minmax(150px,1.6fr)_56px_minmax(84px,1fr)_minmax(84px,1fr)_auto]";
// Narrow screens read "96% disposable" then the meter; the table reads the meter, then the label under it.
const stat = "grid grid-cols-[118px_minmax(0,1fr)] items-center gap-x-3 md:flex md:flex-col-reverse md:items-stretch md:gap-1";
const flush = { padding: 0 };
const inkText = { color: "var(--ink)" };

function Mark({ mark }: { mark: Row["mark"] }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-[6px] border border-line bg-surface text-ink">
      {typeof mark === "string" ? <Brand id={mark} size={18} /> : <Person initials={mark.initials} size={24} />}
    </span>
  );
}

export function TrashDiagram() {
  return (
    <figure className="card card--surface m-0 overflow-hidden" style={flush} aria-label="The senders table: four senders with volume, unread share, the disposable probability from Jev, and a verdict chip for each">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 md:px-5">
        <span className="text-[14.5px] font-bold">Senders <span className="font-normal text-muted">Last 90 days</span></span>
        <span className="flex flex-wrap items-baseline gap-x-4 text-[12.5px] text-muted">
          <span><b className="mono text-ink">{total}</b> messages</span>
          <span>Reclaimable <b className="display text-[18px] text-ink">{reclaimable}</b></span>
        </span>
      </div>
      <div className={`hidden border-y border-line bg-panel px-5 py-2 text-[11.5px] text-muted md:grid md:gap-x-4 ${COLS}`} aria-hidden="true">
        <span>Sender</span><span className="text-right">Msgs</span><span>Unread</span><span>Jev: disposable</span><span>Verdict</span>
      </div>
      <ul className="m-0 list-none border-t border-line bg-panel p-0 md:border-t-0">
        {ROWS.map((r) => {
          const v = VERDICTS[r.verdict];
          return (
            <li key={r.domain} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 border-b border-line px-4 py-3.5 md:gap-x-4 md:px-5 ${COLS}`}>
              <span className="order-1 col-span-2 flex min-w-0 items-center gap-3 md:order-none md:col-span-1">
                <Mark mark={r.mark} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-bold leading-tight">{r.name}</span>
                  <span className="mono block truncate text-[12px] leading-snug text-muted">{r.domain}</span>
                  <span className="block truncate text-[12px] leading-snug text-muted">{r.kind}</span>
                </span>
              </span>
              <span className="chip order-2 justify-self-start md:order-last md:justify-self-end" style={inkText}><v.icon size={12} aria-hidden="true" />{v.label}</span>
              <span className="order-3 justify-self-end text-[12.5px] text-muted md:order-none md:justify-self-stretch md:text-right"><b className="mono text-[14px] text-ink">{r.messages}</b> <span className="md:hidden">msgs</span></span>
              <span className="order-4 col-span-2 grid gap-y-2 md:contents">
                <span className={stat} title={`${pct(r.unread)} unread`}>
                  <span className="mono whitespace-nowrap text-[11.5px] text-muted">{pct(r.unread)} unread</span>
                  <span className="meter block"><i style={{ width: `${Math.max(r.unread * 100, 1.5)}%` }} /></span>
                </span>
                <span className={stat} title={`Jev: disposable ${pct(r.disposable)}`}>
                  <span className="mono whitespace-nowrap text-[11.5px] text-muted">{pct(r.disposable)} disposable</span>
                  <span className="meter meter--warn block"><i style={{ width: `${Math.max(r.disposable * 100, 1.5)}%` }} /></span>
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2 bg-panel px-4 py-3 md:px-5">
        <span className="btn-primary btn-sm" aria-hidden="true"><Check size={14} />Apply {rules} rules</span>
        <span className="btn btn-sm" aria-hidden="true"><Undo2 size={14} />Undo</span>
        <span className="text-[12.5px] leading-snug text-muted sm:ml-auto">Nothing happens until you click. Trash keeps 30 days.</span>
      </div>
    </figure>
  );
}
