"use client";
import { ConfirmButton } from "@/components/Confirm";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, RefreshCw, Shield, Trash2, Undo2, UserRound } from "lucide-react";
import type { SenderDecision, SenderJudgment } from "@/db/schema";
import { num, pct, usd, when } from "@/lib/format";

export type SenderRow = {
  domain: string; displayName: string | null; messages: number; unread: number; inInbox: number; lastSeenAt: string | Date | null; sampleSubjects: string[]; listUnsubscribe: string | null;
  judgment: SenderJudgment | null; decision: SenderDecision; trashAfterDays: number | null; recommendation: { rec: "protect" | "trash-old" | "trash-all" | "keep"; reason: string };
};

const REC_LABEL: Record<SenderRow["recommendation"]["rec"], { text: string; cls: string }> = {
  "trash-all": { text: "could trash all", cls: "chip--warn" },
  "trash-old": { text: "could trash after 30d", cls: "chip--warn" },
  protect: { text: "protect", cls: "chip--accent" },
  keep: { text: "keep", cls: "" },
};

function unsubscribeUrl(h: string | null): string | null {
  if (!h) return null;
  const m = h.match(/<(https?:[^>]+)>/);
  return m?.[1] ?? null;
}

export function SenderTable({ rows, mode }: { rows: SenderRow[]; mode: "trash" | "all" }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "trash-all" | "trash-old" | "protect" | "keep">(mode === "trash" ? "all" : "all");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => rows.filter((r) => (filter === "all" ? (mode === "trash" ? r.recommendation.rec.startsWith("trash") || r.decision?.startsWith("trash") : true) : r.recommendation.rec === filter)).filter((r) => !query || `${r.domain} ${r.displayName ?? ""}`.toLowerCase().includes(query.toLowerCase())), [rows, filter, query, mode]);
  const reclaimable = useMemo(() => shown.filter((r) => r.recommendation.rec.startsWith("trash")).reduce((n, r) => n + r.messages, 0), [shown]);

  async function decide(domain: string, decision: SenderDecision, applyNow = false, trashAfterDays = 30) {
    setBusy(domain); setMsg(null);
    const res = await fetch("/api/senders/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain, decision, applyNow, trashAfterDays }) });
    const json = (await res.json()) as { applied?: { runId: string; messages: number } | null; error?: string };
    if (json.error) setMsg(json.error);
    else if (json.applied) { setMsg(`Trashed ${json.applied.messages} from ${domain}.`); if (json.applied.runId) setLastRun(json.applied.runId); }
    else setMsg(`${domain}: ${decision ?? "cleared"}. The daily run enforces it.`);
    setBusy(null); router.refresh();
  }
  async function undo() {
    if (!lastRun) return;
    await fetch(`/api/runs/${lastRun}/undo`, { method: "POST" });
    setLastRun(null); setMsg("Undone."); router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "trash-all", "trash-old", "protect", "keep"] as const).map((f) => (
            <button key={f} type="button" className={`chip ${filter === f ? "chip--accent" : ""}`} onClick={() => setFilter(f)}>{f === "all" ? (mode === "trash" ? "recommended" : "all senders") : REC_LABEL[f].text} {f === "all" ? shown.length : rows.filter((r) => r.recommendation.rec === f).length}</button>
          ))}
        </div>
        <input className="input ml-auto max-w-xs" style={{ minHeight: 36 }} placeholder="filter senders" value={query} onChange={(e) => setQuery(e.target.value)} />
        {mode === "trash" ? <span className="text-xs text-muted">{num(reclaimable)} messages across the recommended senders. Nothing happens until you click a row.</span> : null}
      </div>
      <div className="flex min-h-5 items-center gap-2 text-xs text-muted">{msg ? <span className="flex items-center gap-1"><Check size={13} /> {msg}</span> : null}{lastRun ? <button className="btn btn-sm" onClick={undo}><Undo2 size={13} /> Undo last</button> : null}</div>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Sender</th><th className="text-right">Messages</th><th>Unread</th><th>Jev</th><th>Recommendation</th><th></th></tr></thead>
          <tbody>
            {shown.map((r) => {
              const rec = REC_LABEL[r.recommendation.rec];
              const unsub = unsubscribeUrl(r.listUnsubscribe);
              const unreadRatio = r.messages ? r.unread / r.messages : 0;
              return (
                <tr key={r.domain}>
                  <td>
                    <div className="font-semibold">{r.displayName ?? r.domain}</div>
                    <div className="mono text-[12px] text-muted">{r.domain} · last {when(r.lastSeenAt)}</div>
                    {r.sampleSubjects.length ? <div className="mt-1 max-w-md truncate text-[12px] text-muted" title={r.sampleSubjects.join(" · ")}>{r.sampleSubjects.slice(0, 2).join(" · ")}</div> : null}
                  </td>
                  <td className="text-right font-semibold">{num(r.messages)}</td>
                  <td style={{ minWidth: 110 }}>
                    <div className="meter"><i style={{ width: `${Math.round(unreadRatio * 100)}%` }} /></div>
                    <div className="text-[12px] text-muted">{pct(unreadRatio)} unread</div>
                  </td>
                  <td className="text-[12px] text-muted" style={{ minWidth: 150 }}>
                    {r.judgment ? (<>
                      <div>{r.judgment.category}</div>
                      <div>disposable {pct(r.judgment.safeToTrashOld)} · human {pct(r.judgment.human)}</div>
                    </>) : "not judged yet"}
                  </td>
                  <td style={{ minWidth: 170 }}>
                    <span className={`chip ${rec.cls}`}>{r.decision ? <Check size={12} /> : null} {rec.text}</span>
                    <div className="mt-1 text-[12px] text-muted">{r.recommendation.reason}</div>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {r.recommendation.rec !== "protect" || r.decision ? null : null}
                      <button className="btn btn-sm" disabled={busy !== null} title="Never trash or archive this sender" onClick={() => decide(r.domain, "protect")}><Shield size={13} /></button>
                      <ConfirmButton className="btn btn-sm" armedClassName="btn-primary btn-sm" disabled={busy !== null} label={<>30d <Trash2 size={13} /></>} confirmLabel="Trash older than 30d" onConfirm={() => decide(r.domain, "trash-old", true)} />
                      <ConfirmButton className="btn btn-sm btn-danger" armedClassName="btn-danger btn-sm" disabled={busy !== null} label={<>all <Trash2 size={13} /></>} confirmLabel="Trash all from this sender" onConfirm={() => decide(r.domain, "trash-all", true)} />
                      {mode === "all" ? <button className="btn btn-sm" disabled={busy !== null} title="A person: label Personal and keep important" onClick={() => decide(r.domain, "family")}><UserRound size={13} /></button> : null}
                      {unsub ? <a className="btn btn-sm" href={unsub} target="_blank" rel="noreferrer" title="Open the sender's unsubscribe link (you click it, Mailroom never does)"><ExternalLink size={13} /></a> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!shown.length ? <tr><td colSpan={6} className="text-center text-sm text-muted">Nothing here. Run a scan first, or loosen the filter.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ScanButton({ label = "Scan senders" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function scan() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/senders/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: 90, maxMessages: 1500 }) });
    const json = (await res.json()) as { messagesScanned?: number; senders?: number; judged?: number; estimatedCostUsd?: number; error?: string };
    setMsg(json.error ?? `Scanned ${num(json.messagesScanned ?? 0)} messages from ${json.senders} senders, judged ${json.judged} new ones for ${usd(json.estimatedCostUsd ?? 0)}.`);
    setBusy(false); router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn-primary" disabled={busy} onClick={scan}><RefreshCw size={15} className={busy ? "animate-spin" : ""} /> {busy ? "Scanning the last 90 days…" : label}</button>
      {msg ? <span className="text-sm text-muted">{msg}</span> : null}
    </div>
  );
}
