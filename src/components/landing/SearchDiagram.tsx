import { Archive, AtSign, CalendarDays, Check, Search, Tag, Undo2 } from "lucide-react";
import { Wire } from "./iso";
import { Brand, type BrandId } from "./Brand";

/*
 * One search, top to bottom: the words typed, the parts the compiler found, the Gmail query it wrote,
 * and the results after Jev reranks them. Numbers first: how many, how many unread, how relevant.
 */
const QUERY = 'label:"Receipts" from:uber.com newer_than:30d';
type Result = { mark: BrandId; from: string; subject: string; when: string; score: number; unread: boolean };
const RESULTS: Result[] = [
  { mark: "uber", from: "Uber Receipts", subject: "Your Tuesday morning trip with Uber", when: "Sep 3", score: 0.96, unread: true },
  { mark: "ubereats", from: "Uber Eats", subject: "Your order from Saigon Sandwich is complete", when: "Aug 28", score: 0.91, unread: true },
  { mark: "uber", from: "Uber Receipts", subject: "Your Friday evening trip with Uber", when: "Aug 14", score: 0.88, unread: false },
];
const unread = RESULTS.filter((r) => r.unread).length;
const flush = { padding: 0 };

function Down({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 sm:px-5" aria-hidden="true">
      <svg viewBox="0 0 24 36" className="h-9 w-6 shrink-0"><Wire d="M12 0V36" /></svg>
      <span className="text-[12.5px] font-medium text-muted">{label}</span>
    </div>
  );
}

export function SearchDiagram() {
  return (
    <figure className="card card--surface m-0 overflow-hidden" style={flush} aria-label="A natural-language search compiled into a Gmail query, then run and reranked by Jev: three results, two unread">
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-3 rounded-[6px] border border-ink bg-panel px-3.5 py-3">
          <Search size={18} className="shrink-0 text-ink" aria-hidden="true" />
          <span className="cursor min-w-0 flex-1 text-[15px] font-bold leading-snug sm:text-[16px]">Receipts from Uber last month</span>
          <span className="kbd ml-auto hidden shrink-0 sm:inline-block">Enter</span>
        </div>
      </div>
      <Down label="Compile" />
      <div className="px-4 sm:px-5">
        <div className="flex flex-wrap gap-2">
          <span className="chip chip--accent"><Tag size={13} aria-hidden="true" />Category: Receipts</span>
          <span className="chip chip--accent"><AtSign size={13} aria-hidden="true" />Sender: uber.com</span>
          <span className="chip chip--accent"><CalendarDays size={13} aria-hidden="true" />Window: 30 days</span>
        </div>
        <pre className="mono mt-3 overflow-x-auto rounded-[6px] border border-line bg-panel px-3.5 py-2.5 text-[13.5px] leading-relaxed">{QUERY}</pre>
      </div>
      <Down label="Run, then rerank with Jev" />
      <div className="border-t border-line bg-panel">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-4 sm:px-5">
          <span className="display text-[clamp(24px,3vw,32px)] leading-none">{RESULTS.length} results <span className="text-muted">· {unread} unread</span></span>
          <span className="text-[12px] text-muted">Relevance from Jev</span>
        </div>
        <ul className="m-0 list-none p-0">
          {RESULTS.map((r) => (
            <li key={r.subject} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 border-t border-line px-4 py-2.5 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:px-5">
              <span className="hidden size-4 shrink-0 place-items-center rounded-[4px] bg-accent text-page sm:grid" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
              <span className="grid size-9 shrink-0 place-items-center rounded-[6px] border border-line bg-surface text-ink"><Brand id={r.mark} size={18} /></span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  {r.unread ? <i className="size-1.5 shrink-0 rounded-full bg-ink" role="img" aria-label="unread" /> : null}
                  <span className={`truncate text-[14px] leading-tight ${r.unread ? "font-bold" : "font-medium"}`}>{r.from}</span>
                  <span className="mono hidden shrink-0 text-[12px] text-muted sm:inline">{r.when}</span>
                </span>
                <span className="block truncate text-[13px] text-muted">{r.subject}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2" title={`Relevance ${r.score.toFixed(2)}`}>
                <span className="meter hidden w-14 sm:block"><i style={{ width: `${r.score * 100}%` }} /></span>
                <span className="mono w-8 text-right text-[12.5px] font-bold">{r.score.toFixed(2)}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 sm:px-5">
          <span className="text-[12.5px] text-muted">{RESULTS.length} selected</span>
          <span className="ml-auto flex flex-wrap gap-1.5" aria-hidden="true">
            <span className="btn btn-sm"><Archive size={14} />Archive</span>
            <span className="btn btn-sm"><Tag size={14} />Label</span>
            <span className="btn btn-sm"><Undo2 size={14} />Undo</span>
          </span>
        </div>
      </div>
    </figure>
  );
}
