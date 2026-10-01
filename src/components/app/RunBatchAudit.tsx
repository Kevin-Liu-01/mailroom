"use client";
import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Sparkles, Undo2 } from "lucide-react";
import { SenderMark, TonedChip, TonedMeter } from "@/components/app/Bits";
import { num, when } from "@/lib/format";
import type { RuleKind, Verdict } from "@/lib/ai/grade";

type Row = { id: string; gone?: true; from?: string; subject?: string; date?: string | null; inTrash?: boolean; verdict?: Verdict; actionOk?: number; belongs?: number; worthKeeping?: number; why?: string };
type Page = { total: number; rows: Row[]; cost: { inputTokens: number; usd: number }; error?: string };

const PAGE = 40;
const senderName = (from: string) => { const m = from.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>/); return (m ? m[1] : from.replace(/<.*>/, "")).trim() || from; };
const usd = (n: number) => (n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);

/**
 * Grade one batch with Jev, forty emails at a time, and offer to reverse the ones it disagrees with.
 * The grader sees the rule's intent and each email's metadata; the counts and the list update as pages land.
 */
export function RunBatchAudit({ runId, batchId, total, kind }: { runId: string; batchId: string; total: number; kind: RuleKind }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cost, setCost] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [restoring, setRestoring] = useState(false);
  const [restored, setRestored] = useState<Set<string>>(new Set());
  const stop = useRef(false);

  async function grade() {
    setRunning(true); setDone(false); setError(null); stop.current = false;
    let offset = rows.length;
    while (offset < total && !stop.current) {
      try {
        const res = await fetch(`/api/runs/${runId}/audit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId, offset, limit: PAGE }) });
        const page = (await res.json()) as Page;
        if (page.error) { setError(page.error); break; }
        setRows((r) => [...r, ...page.rows]);
        setCost((c) => c + page.cost.usd);
        setSelected((s) => { const n = new Set(s); for (const row of page.rows) if (row.verdict === "disagree") n.add(row.id); return n; });
        offset += page.rows.length;
        if (!page.rows.length) break;
      } catch (err) { setError(err instanceof Error ? err.message : "Grading failed."); break; }
    }
    setRunning(false); setDone(offset >= total);
  }

  const counts = useMemo(() => ({ agree: rows.filter((r) => r.verdict === "agree").length, unsure: rows.filter((r) => r.verdict === "unsure").length, disagree: rows.filter((r) => r.verdict === "disagree").length }), [rows]);
  const flagged = useMemo(() => rows.filter((r) => r.verdict && r.verdict !== "agree").sort((a, b) => (a.verdict === b.verdict ? (b.worthKeeping ?? 0) - (a.worthKeeping ?? 0) : a.verdict === "disagree" ? -1 : 1)), [rows]);
  const graded = counts.agree + counts.unsure + counts.disagree;
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const restoreWord = kind === "trash" ? "Take out of Trash" : kind === "archive" ? "Put back in the inbox" : "Undo the label";

  async function restore() {
    const ids = [...selected].filter((id) => !restored.has(id));
    if (!ids.length) return;
    setRestoring(true);
    try {
      const res = await fetch(`/api/runs/${runId}/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId, messageIds: ids }) });
      const json = (await res.json()) as { restored?: number; error?: string };
      if (json.error) setError(json.error);
      else setRestored((r) => new Set([...r, ...ids]));
    } catch (err) { setError(err instanceof Error ? err.message : "Could not restore."); }
    setRestoring(false);
  }

  return (
    <div className="space-y-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          {graded ? (
            <>
              <TonedMeter value={graded ? counts.agree / graded : 0} label="Agree" tone="green" strong width={90} />
              <span className="font-mono text-muted">{num(counts.agree)} agree · {num(counts.unsure)} unsure · {num(counts.disagree)} disagree · {num(graded)} of {num(total)} graded</span>
            </>
          ) : <span className="text-muted">Ask Jev whether each of these {num(total)} emails was handled right.</span>}
        </div>
        <div className="flex items-center gap-2">
          {running ? <button type="button" className="btn btn-sm" onClick={() => { stop.current = true; }}><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Grading… stop</button>
            : !done ? <button type="button" className="btn btn-sm" onClick={grade}><Sparkles size={13} aria-hidden="true" /> {graded ? "Keep grading" : "Grade with Jev"}</button>
            : <span className="inline-flex items-center gap-1.5 text-[13px] text-muted"><CheckCircle2 size={14} aria-hidden="true" /> All graded · Jev {usd(cost)}</span>}
        </div>
      </div>
      {error ? <p className="m-0 text-sm text-muted">{error}</p> : null}
      {flagged.length ? (
        <div className="space-y-2">
          <ul className="m-0 list-none divide-y divide-line p-0">
            {flagged.map((r) => (
              <li key={r.id} className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 py-2 text-[13.5px]">
                <input type="checkbox" className="size-4" checked={selected.has(r.id)} disabled={restored.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.subject ?? r.id}`} />
                <SenderMark from={r.from ?? ""} size={16} />
                <span className="min-w-0">
                  <span className="flex items-baseline gap-2"><span className="truncate font-medium">{senderName(r.from ?? "")}</span><span className="shrink-0 font-mono text-[12px] text-muted">{r.date ? when(r.date) : ""}</span></span>
                  <span className="block truncate text-muted">{r.subject}</span>
                  <span className="block text-[12.5px] text-muted">{r.why}</span>
                </span>
                {restored.has(r.id) ? <TonedChip tone="green">Restored</TonedChip> : <TonedChip tone={r.verdict === "disagree" ? "red" : "amber"}>{r.verdict === "disagree" ? "Disagree" : "Unsure"}</TonedChip>}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-sm" disabled={restoring || ![...selected].some((id) => !restored.has(id))} onClick={restore}>
              {restoring ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Undo2 size={13} aria-hidden="true" />} {restoreWord} · {num([...selected].filter((id) => !restored.has(id)).length)}
            </button>
            <span className="text-[12.5px] text-muted">Disagreements are pre-selected. Everything else stays as the run left it.</span>
          </div>
        </div>
      ) : done ? <p className="m-0 text-sm text-muted">Jev agrees with every one of them.</p> : null}
    </div>
  );
}
