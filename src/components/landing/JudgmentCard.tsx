import { Stamp } from "lucide-react";
import { USD_PER_INPUT_TOKEN } from "@/lib/ai/triage";
import { Brand } from "./Brand";

/*
 * One typed judgment for one real-looking email. The Choice comes back as a distribution over categories;
 * each Noul comes back as a probability, and the policy draws a threshold through it.
 */
const EMAIL = {
  from: "Coastal Recruiting",
  address: "talent@coastalrecruiting.com",
  subject: "Senior Frontend role - remote",
  snippet: "Your GitHub caught our eye. We are hiring a remote Senior Frontend Engineer.",
  headers: ["List-Unsubscribe: yes", "Precedence: bulk", "tab: Primary"],
};
const CHOICE: [string, number][] = [
  ["Recruiting", 0.88],
  ["Work", 0.06],
  ["Marketing & Deals", 0.03],
  ["Social Media", 0.02],
];
type Noul = { q: string; p: number; t: number | null; note: string };
const NOULS: Noul[] = [
  { q: "Automated?", p: 0.93, t: 0.85, note: "Past 0.85, so it archives out of Primary." },
  { q: "Needs action?", p: 0.21, t: 0.7, note: "Below 0.70, so no Action Needed label." },
  { q: "Time-sensitive?", p: 0.34, t: null, note: "No threshold. A dashboard signal only." },
  { q: "Disposable?", p: 0.67, t: 0.8, note: "Below 0.80. The trash scan leaves it." },
];
// Measured on real mail: a state plus four questions runs 1,188 to 1,224 input tokens.
const TOKENS = 1224;
const cost = `$${(TOKENS * USD_PER_INPUT_TOKEN).toFixed(5)}`;
const flush = { padding: 0 };

function Meter({ value, threshold, height = 6 }: { value: number; threshold?: number | null; height?: number }) {
  return (
    <span className="meter block w-full" style={{ height }}>
      <i style={{ width: `${value * 100}%` }} />
      {threshold != null ? <b aria-hidden="true" style={{ position: "absolute", top: -1, bottom: -1, left: `calc(${threshold * 100}% - 1px)`, width: 2, background: "var(--ink)" }} /> : null}
    </span>
  );
}

const row = "grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[136px_minmax(0,1fr)_2.5rem]";

export function JudgmentCard() {
  return (
    <figure className="card card--surface m-0 overflow-hidden" style={flush} aria-label="One Jev judgment for a recruiting email: a category distribution, four probabilities against their thresholds, and the cost">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
        <span className="flex items-center gap-2 text-[14.5px] font-bold"><Stamp size={16} className="text-ink" aria-hidden="true" />One judgment</span>
        <span className="chip chip--accent">Metadata only</span>
      </div>
      <div className="border-t border-line bg-panel px-4 py-3.5 text-[13px] sm:px-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[6px] border border-line bg-surface text-ink"><Brand id="linkedin" size={20} title="Recruiting" /></span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-bold leading-tight">{EMAIL.from}</span>
            <span className="mono block truncate text-[12px] text-muted">{EMAIL.address}</span>
          </span>
        </div>
        <p className="mt-3 text-[14px] font-bold leading-snug">{EMAIL.subject}</p>
        <p className="mt-1 leading-snug text-muted">{EMAIL.snippet}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {EMAIL.headers.map((h) => <span key={h} className="chip">{h}</span>)}
        </div>
      </div>
      <div className="border-t border-line px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[13px]">
          <span className="font-bold">Category <span className="font-normal text-muted">(Choice, top 4 of 14)</span></span>
          <span className="text-muted">Labeled at <b className="mono text-ink">0.60</b> or higher</span>
        </div>
        <ul className="m-0 mt-2.5 list-none space-y-2 p-0">
          {CHOICE.map(([label, p], i) => (
            <li key={label} className={row}>
              <span className={`truncate text-[13px] sm:order-1 ${i === 0 ? "font-bold" : ""}`}>{label}</span>
              <span className={`mono text-right text-[12.5px] sm:order-3 ${i === 0 ? "font-bold" : "text-muted"}`}>{p.toFixed(2)}</span>
              <span className="col-span-2 sm:order-2 sm:col-span-1"><Meter value={p} height={i === 0 ? 10 : 6} /></span>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-line px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[13px]">
          <span className="font-bold">Four Nouls <span className="font-normal text-muted">(yes or no, as probabilities)</span></span>
          <span className="text-muted">Tick marks the threshold</span>
        </div>
        <ul className="m-0 mt-2.5 list-none space-y-3 p-0">
          {NOULS.map((n) => (
            <li key={n.q} className={row}>
              <span className="text-[13px] font-bold sm:order-1">{n.q}</span>
              <span className="mono text-right text-[12.5px] font-bold sm:order-3">{n.p.toFixed(2)}</span>
              <span className="col-span-2 sm:order-2 sm:col-span-1"><Meter value={n.p} threshold={n.t} /></span>
              <span className="col-span-2 text-[12px] leading-snug text-muted sm:order-4 sm:col-span-3">{n.note}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-panel px-4 py-3 text-[12.5px] sm:px-5">
        <span className="chip chip--accent">Label: Recruiting</span>
        <span className="chip">Archive</span>
        <span className="chip">No flag</span>
        <span className="ml-auto text-muted"><b className="mono text-ink">{TOKENS.toLocaleString("en-US")}</b> tokens · <b className="mono text-ink">{cost}</b></span>
      </div>
    </figure>
  );
}
