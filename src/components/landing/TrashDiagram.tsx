import { Check, Landmark, ListChecks, Trash, Undo2, UserRound } from "lucide-react";

const SENDERS = [
  { sender: "em.target.com", kind: "Promotions, three a week", count: 214, read: 0, verdict: "trash" },
  { sender: "news.linkedin.com", kind: "Social digests", count: 168, read: 3, verdict: "trash" },
  { sender: "chase.com", kind: "Statements and alerts", count: 42, read: 88, verdict: "keep" },
  { sender: "maria.k@gmail.com", kind: "A person who writes to you", count: 19, read: 100, verdict: "protect" },
] as const;

const VERDICTS = {
  trash: { className: "chip", style: { background: "var(--ink)", color: "var(--page)", borderColor: "var(--ink)" }, label: "Trash after 30 days", icon: Trash },
  keep: { className: "chip", style: { background: "var(--surface)" }, label: "Keep, records", icon: Landmark },
  protect: { className: "chip", style: undefined, label: "Protect, human", icon: UserRound },
};

const reclaimable = SENDERS.filter((s) => s.verdict === "trash").reduce((n, s) => n + s.count, 0);

export function TrashDiagram() {
  return (
    <figure className="card card--surface m-0 overflow-hidden p-0" aria-label="A sender-by-sender scan with a verdict for each sender">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
        <span className="eyebrow">Sender scan</span>
        <span className="text-[13px] text-muted">Reclaimable <b className="mono text-ink">{reclaimable}</b> messages</span>
      </div>
      <ul className="m-0 list-none border-t border-line bg-panel p-0">
        {SENDERS.map((s) => {
          const v = VERDICTS[s.verdict];
          return (
            <li key={s.sender} className="grid grid-cols-1 items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5">
              <span className="min-w-0">
                <span className="mono block truncate text-[13.5px] font-semibold">{s.sender}</span>
                <span className="block truncate text-[12.5px] text-muted">{s.kind}</span>
              </span>
              <span className={`${v.className} order-3 justify-self-start sm:order-none sm:justify-self-end`} style={v.style}><v.icon size={13} aria-hidden="true" />{v.label}</span>
              <span className="flex items-center gap-3 text-[12.5px] text-muted sm:col-span-2">
                <span className="mono w-16 shrink-0">{s.count} msgs</span>
                <span className="meter block flex-1"><i style={{ width: `${Math.max(s.read, 2)}%` }} /></span>
                <span className="mono w-16 shrink-0 text-right">{s.read}% read</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2 bg-panel px-4 py-3 sm:px-5">
        <span className="btn-primary btn-sm" aria-hidden="true"><Check size={14} />Apply {reclaimable} changes</span>
        <span className="btn btn-sm" aria-hidden="true"><Undo2 size={14} />Undo</span>
        <span className="chip sm:ml-auto"><ListChecks size={13} aria-hidden="true" />becomes a standing rule</span>
      </div>
    </figure>
  );
}
