import { Archive, AtSign, CalendarDays, Check, Search, Sparkles, Tag, Trash, Undo2 } from "lucide-react";
import { Wire } from "./iso";

const QUERY = 'label:"Receipts" from:uber.com newer_than:30d';
const RESULTS = [
  { from: "Uber Receipts", subject: "Your Tuesday morning trip with Uber", when: "Sep 3", score: 0.96 },
  { from: "Uber Eats", subject: "Your order from Saigon Sandwich is complete", when: "Aug 28", score: 0.91 },
  { from: "Uber Receipts", subject: "Your Friday evening trip with Uber", when: "Aug 14", score: 0.88 },
];

function Down({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 sm:px-5" aria-hidden="true">
      <svg viewBox="0 0 24 36" className="h-9 w-6 shrink-0"><Wire d="M12 0V36" /></svg>
      <span className="text-[11.5px] font-bold uppercase tracking-[.12em] text-muted">{label}</span>
    </div>
  );
}

export function SearchDiagram() {
  return (
    <figure className="card card--surface m-0 overflow-hidden p-0" aria-label="A natural-language search compiled into a Gmail query, then run and reranked">
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-3 rounded-[6px] border border-line bg-panel px-3.5 py-3">
          <Search size={18} className="shrink-0 text-ink" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-[16px] font-semibold leading-snug">receipts from uber last month</span>
          <span className="kbd ml-auto shrink-0">Enter</span>
        </div>
      </div>
      <Down label="Compile" />
      <div className="px-4 sm:px-5">
        <div className="flex flex-wrap gap-2">
          <span className="chip chip--accent"><Tag size={13} aria-hidden="true" />category: Receipts</span>
          <span className="chip chip--accent"><AtSign size={13} aria-hidden="true" />sender: uber.com</span>
          <span className="chip chip--accent"><CalendarDays size={13} aria-hidden="true" />window: 30 days</span>
        </div>
        <pre className="mono mt-3 overflow-x-auto rounded-[6px] border border-line bg-panel px-3.5 py-2.5 text-[13.5px] leading-relaxed">{QUERY}</pre>
      </div>
      <Down label="Run, then rerank with Jev" />
      <ul className="m-0 list-none border-t border-line bg-panel p-0">
        {RESULTS.map((r) => (
          <li key={r.subject} className="flex items-center gap-3 border-b border-line px-4 py-2.5 sm:px-5">
            <span className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-accent text-page" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold">{r.from}</span>
              <span className="block truncate text-[13px] text-muted">{r.subject}</span>
            </span>
            <span className="mono hidden shrink-0 text-[12px] text-muted sm:inline">{r.when}</span>
            <span className="flex shrink-0 items-center gap-2" title="Relevance from Jev">
              <span className="meter hidden w-12 sm:block"><i style={{ width: `${r.score * 100}%` }} /></span>
              <span className="mono w-8 text-right text-[12px] text-muted">{r.score.toFixed(2)}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 bg-panel px-4 py-3 sm:px-5">
        <span className="chip"><Sparkles size={13} aria-hidden="true" />3 results, reranked</span>
        <span className="ml-auto flex flex-wrap gap-1.5" aria-hidden="true">
          <span className="btn btn-sm"><Archive size={14} />Archive</span>
          <span className="btn btn-sm"><Trash size={14} />Trash</span>
          <span className="btn btn-sm"><Tag size={14} />Label</span>
          <span className="btn btn-sm"><Undo2 size={14} />Undo</span>
        </span>
      </div>
    </figure>
  );
}
