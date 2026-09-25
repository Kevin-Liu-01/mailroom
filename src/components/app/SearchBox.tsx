"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, Sparkles } from "lucide-react";

export const PRESETS = [
  { label: "Needs my reply", q: "mail from real people that still needs my reply" },
  { label: "Unread from people this week", q: "unread mail from real people this week" },
  { label: "Receipts this month", q: "receipts from the last 30 days" },
  { label: "Recruiters I never answered", q: "recruiters I never answered" },
  { label: "Security codes", q: "verification codes and sign-in alerts" },
  { label: "Safe to trash", q: "what can I trash" },
  { label: "Big attachments", q: "large attachments older than 6 months" },
];

export function SearchBox({ initial = "", autoFocus = false, compact = false }: { initial?: string; autoFocus?: boolean; compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  function go(text: string) {
    const t = text.trim();
    if (!t) return;
    router.push(`/app/search?q=${encodeURIComponent(t)}`);
  }
  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); go(q); }}>
        <label className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-11" style={{ minHeight: compact ? 42 : 52, fontSize: compact ? 14 : 15.5 }} placeholder="ask your mailbox: receipts from uber last month · unread mail from real people · recruiters I never answered" value={q} onChange={(e) => setQ(e.target.value)} autoFocus={autoFocus} />
        </label>
        <button className="btn-primary" type="submit" style={{ minHeight: compact ? 42 : 52 }}><Sparkles size={16} /> Search</button>
      </form>
      {!compact ? (
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => <button key={p.q} type="button" className="chip hover:border-accent" onClick={() => go(p.q)}>{p.label}</button>)}
        </div>
      ) : null}
    </div>
  );
}
