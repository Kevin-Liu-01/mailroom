import { Stamp } from "lucide-react";
import { USD_PER_INPUT_TOKEN } from "@/lib/ai/triage";
import { usd } from "@/lib/format";

const META = [
  ["From", "Chase <no.reply.alerts@chase.com>"],
  ["Subject", "Your statement is ready"],
  ["Snippet", "Your September statement for the account ending 4821 is available to view."],
  ["Headers", "List-Unsubscribe: yes. Precedence: bulk."],
];
const CHOICE = [
  ["Banking & Finance", 0.91],
  ["Receipts", 0.05],
  ["Accounts & Security", 0.03],
] as const;
const NOULS = [
  { q: "Automated?", p: 0.97, t: 0.85, note: "Past 0.85, but Finance is not a noisy category, so it stays in the inbox." },
  { q: "Needs action?", p: 0.12, t: 0.7, note: "Below 0.7, so no Action Needed label." },
  { q: "Time-sensitive?", p: 0.31, t: null, note: "Kept as a dashboard signal." },
  { q: "Disposable?", p: 0.08, t: null, note: "A record. The trash scan keeps it." },
];
// Measured on real mail: a state plus four questions runs 1,188 to 1,224 input tokens.
const TOKENS = 1212;

function Meter({ value, threshold }: { value: number; threshold?: number | null }) {
  return (
    <span className="meter block w-full">
      <i style={{ width: `${value * 100}%` }} />
      {threshold != null ? <b aria-hidden="true" style={{ position: "absolute", top: -1, bottom: -1, left: `calc(${threshold * 100}% - 1px)`, width: 2, background: "var(--ink)" }} /> : null}
    </span>
  );
}

export function JudgmentCard() {
  return (
    <figure className="card card--surface m-0 overflow-hidden p-0" aria-label="One Jev judgment: metadata in, a category distribution and four probabilities out">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
        <span className="flex items-center gap-2 font-bold"><Stamp size={16} className="text-ink" aria-hidden="true" />One judgment</span>
        <span className="chip chip--accent">metadata only</span>
      </div>
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-line bg-panel px-4 py-3 text-[13px] sm:px-5">
        {META.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="mono text-muted">{k}</dt>
            <dd className="m-0 min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-line px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <span className="font-bold">Category <span className="font-medium text-muted">(Choice)</span></span>
          <span className="text-muted">confidence <b className="mono text-ink">0.91</b>, labeled at 0.6 or higher</span>
        </div>
        <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
          {CHOICE.map(([label, p]) => (
            <li key={label} className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[140px_minmax(0,1fr)_2.5rem]">
              <span className="truncate text-[13px] sm:order-1">{label}</span>
              <span className="mono text-right text-[12px] text-muted sm:order-3">{p.toFixed(2)}</span>
              <span className="col-span-2 sm:order-2 sm:col-span-1"><Meter value={p} /></span>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-line px-4 py-3 sm:px-5">
        <div className="text-[13px] font-bold">Four Nouls <span className="font-medium text-muted">(yes or no, as probabilities)</span></div>
        <ul className="m-0 mt-2 list-none space-y-2.5 p-0">
          {NOULS.map((n) => (
            <li key={n.q} className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[140px_minmax(0,1fr)_2.5rem]">
              <span className="text-[13px] font-semibold sm:order-1">{n.q}</span>
              <span className="mono text-right text-[12px] text-muted sm:order-3">{n.p.toFixed(2)}</span>
              <span className="col-span-2 sm:order-2 sm:col-span-1"><Meter value={n.p} threshold={n.t} /></span>
              <span className="col-span-2 text-[12px] leading-snug text-muted sm:order-4 sm:col-span-3">{n.note}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-panel px-4 py-3 text-[12.5px] sm:px-5">
        <span className="chip chip--accent">label: Banking &amp; Finance</span>
        <span className="chip">no flag</span>
        <span className="chip">stays</span>
        <span className="ml-auto text-muted"><b className="mono text-ink">{TOKENS.toLocaleString("en-US")}</b> tokens, {usd(TOKENS * USD_PER_INPUT_TOKEN)}</span>
      </div>
    </figure>
  );
}
