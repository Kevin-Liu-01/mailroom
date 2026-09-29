"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { BarChart3, CalendarClock, GitBranch, Hash, Hourglass, KeyRound, Landmark, MailOpen, Newspaper, Paperclip, Receipt, Reply, RotateCcw, Search, Sparkles, Tag, UserSearch } from "lucide-react";

export type Preset = { label: string; q: string; icon: LucideIcon; hint: string };
export const PRESET_GROUPS: { name: string; items: Preset[] }[] = [
  {
    name: "Owed",
    items: [
      { label: "Needs my reply", q: "mail from real people that still needs my reply", icon: Reply, hint: "Conversations where the other person spoke last" },
      { label: "Waiting on them", q: "people who haven't replied to my last message", icon: Hourglass, hint: "Conversations where you spoke last and nothing came back" },
      { label: "Recruiters I never answered", q: "recruiters I never answered", icon: UserSearch, hint: "Recruiting threads with no message from you" },
      { label: "Due soon", q: "things that are due or expiring this week", icon: CalendarClock, hint: "Deadlines, RSVPs, and expiring offers, ranked by urgency" },
    ],
  },
  {
    name: "Money",
    items: [
      { label: "Receipts this month", q: "receipts from the last 30 days", icon: Receipt, hint: "Orders, rides, deliveries, and their confirmations" },
      { label: "Statements and bills", q: "bank statements and bills from the last 3 months", icon: Landmark, hint: "Banking & Finance over the last quarter" },
      { label: "Refunds and returns", q: "refunds and returns from the last 90 days", icon: RotateCcw, hint: "Money coming back to you" },
    ],
  },
  {
    name: "Mailbox",
    items: [
      { label: "Unread from people this week", q: "unread mail from real people this week", icon: MailOpen, hint: "Humans only, not campaigns or notifications" },
      { label: "Security codes today", q: "verification codes and sign-in alerts from today", icon: KeyRound, hint: "Accounts & Security mail from the last day" },
      { label: "Big attachments", q: "large attachments older than 6 months", icon: Paperclip, hint: "Over 5 MB and at least six months old" },
      { label: "How many unread this week", q: "how many unread messages this week", icon: Hash, hint: "A count with the top senders and labels" },
      { label: "Who emails me most", q: "who emailed me the most this month", icon: BarChart3, hint: "Senders ranked by volume over 30 days" },
    ],
  },
  {
    name: "Clean up",
    items: [
      { label: "Newsletters I never open", q: "newsletters I never open", icon: Newspaper, hint: "Unread newsletters, nothing happens until you act" },
      { label: "Old promotions", q: "promotions older than 30 days", icon: Tag, hint: "Marketing & Deals more than a month old" },
      { label: "Old dev notices", q: "dev notifications older than 90 days", icon: GitBranch, hint: "CI, deploy, and repository mail from last quarter" },
    ],
  },
];
/** Flat list, for anything that still wants the old shape. */
export const PRESETS = PRESET_GROUPS.flatMap((g) => g.items);

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
          <input className="input pl-11" style={{ minHeight: compact ? 42 : 52, fontSize: compact ? 14 : 15.5 }} placeholder="ask your mailbox: receipts from uber last month · unread mail from real people · who hasn't replied to me" value={q} onChange={(e) => setQ(e.target.value)} autoFocus={autoFocus} />
        </label>
        <button className="btn-primary" type="submit" style={{ minHeight: compact ? 42 : 52 }}><Sparkles size={16} /> Search</button>
      </form>
      {!compact ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PRESET_GROUPS.map((g) => (
            <div key={g.name} className="min-w-0">
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-muted">{g.name}</div>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map(({ q: preset, label, icon: Icon, hint }) => (
                  <button key={preset} type="button" className="chip py-1 hover:border-ink hover:text-ink" title={hint} onClick={() => go(preset)}><Icon size={12} aria-hidden="true" />{label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
