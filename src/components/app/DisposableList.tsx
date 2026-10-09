"use client";
import { useMask } from "@/components/app/Privacy";
import { ConfirmButton } from "@/components/Confirm";
import { Meter } from "@/components/app/Bits";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Trash2, Undo2 } from "lucide-react";
import { when } from "@/lib/format";

type Item = { id: string; threadId: string | null; from: string | null; subject: string | null; receivedAt: string | null; category: string; disposable: number };

export function DisposableList({ items }: { items: Item[] }) {
  const mask = useMask();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(items.map((i) => i.id)));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);
  function toggle(id: string) { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); setSelected(n); }
  async function trash() {
    const ids = items.filter((i) => selected.has(i.id)).map((i) => i.id);
    if (!ids.length) return;
    setBusy(true);
    const res = await fetch("/api/messages/modify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action: "trash" }) });
    const json = (await res.json()) as { runId?: string; messages?: number; error?: string };
    setMsg(json.error ?? `Trashed ${json.messages}.`); setLastRun(json.runId ?? null); setBusy(false); router.refresh();
  }
  async function undo() { if (!lastRun) return; await fetch(`/api/runs/${lastRun}/undo`, { method: "POST" }); setLastRun(null); setMsg("Undone."); router.refresh(); }
  if (!items.length) return <p className="card text-sm text-muted">Nothing judged disposable yet. Run the policy once and this fills in.</p>;
  return (
    <div className="card p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={selected.size === items.length} onChange={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)))} /> {selected.size} selected</label>
        <ConfirmButton className="btn btn-sm btn-danger" armedClassName="btn-danger btn-sm" disabled={busy || !selected.size} busy={busy} busyLabel="Trashing…" icon={<Trash2 size={14} aria-hidden="true" />} label="Trash selected" confirmLabel={`Trash ${selected.size}`} message="Recoverable for 30 days, undoable." onConfirm={trash} />
        <span className="ml-auto text-xs text-muted">{msg}</span>
        {lastRun ? <button className="btn btn-sm" onClick={undo}><Undo2 size={13} /> Undo</button> : null}
      </div>
      <ul className="divide-y divide-line">
        {items.map((i) => (
          <li key={i.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
            <input type="checkbox" className="mt-1" checked={selected.has(i.id)} onChange={() => toggle(i.id)} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2"><span className="truncate font-medium">{mask(i.subject) || "(no subject)"}</span><span className="truncate text-[12.5px] text-muted">{mask(i.from)}</span><span className="ml-auto text-xs text-muted">{i.receivedAt ? when(i.receivedAt) : ""}</span></div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[12px]"><span className="chip">{i.category}</span><Meter value={i.disposable} label="disposable" strong />{i.threadId ? <a className="ml-auto inline-flex items-center gap-1 text-muted hover:text-accent-deep" href={`https://mail.google.com/mail/u/0/#all/${i.threadId}`} target="_blank" rel="noreferrer">Open <ExternalLink size={11} /></a> : null}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
