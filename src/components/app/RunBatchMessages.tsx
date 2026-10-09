"use client";
import { useMask } from "@/components/app/Privacy";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SenderMark, TonedChip } from "@/components/app/Bits";
import { when } from "@/lib/format";

type Row = { id: string; gone?: true; from?: string; subject?: string; date?: string | null; inTrash?: boolean; inInbox?: boolean; unread?: boolean; labels?: string[] };

const senderName = (from: string) => {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>/);
  return (m ? m[1] : from.replace(/<.*>/, "")).trim() || from;
};

/** The emails one batch touched: sender, subject, date, and where each sits in Gmail now. Ten first, then thirty at a time. */
export function RunBatchMessages({ runId, batchId, total }: { runId: string; batchId: string; total: number }) {
  const mask = useMask();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(offset: number, limit: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/runs/${runId}/batches/${batchId}?offset=${offset}&limit=${limit}`);
      const json = (await res.json()) as { rows?: Row[]; error?: string };
      if (json.error) setError(json.error);
      else setRows((r) => [...r, ...(json.rows ?? [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read these from Gmail.");
    }
    setLoading(false);
  }
  useEffect(() => {
    let live = true;
    fetch(`/api/runs/${runId}/batches/${batchId}?offset=0&limit=10`).then((r) => r.json()).then((json: { rows?: Row[]; error?: string }) => {
      if (!live) return;
      if (json.error) setError(json.error); else setRows(json.rows ?? []);
      setLoading(false);
    }).catch((err: unknown) => { if (live) { setError(err instanceof Error ? err.message : "Could not read these from Gmail."); setLoading(false); } });
    return () => { live = false; };
  }, [runId, batchId]);

  const remaining = total - rows.length;
  return (
    <div>
      <ul className="m-0 list-none divide-y divide-line p-0">
        {rows.map((r) => (
          <li key={r.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2 text-[13.5px]">
            {r.gone ? <span className="tile tile--sm" aria-hidden="true" /> : <SenderMark from={r.from ?? ""} size={16} />}
            <span className="min-w-0">
              {r.gone ? <span className="text-muted">No longer in Gmail</span> : (
                <>
                  <span className="flex items-baseline gap-2">
                    <span className={`truncate ${r.unread ? "font-semibold" : "font-medium"}`}>{mask(senderName(r.from ?? ""))}</span>
                    <span className="shrink-0 font-mono text-[12px] text-muted">{r.date ? when(r.date) : ""}</span>
                  </span>
                  <span className="block truncate text-muted">{mask(r.subject)}</span>
                </>
              )}
            </span>
            {r.gone ? <span /> : r.inTrash ? <TonedChip tone="amber">Trash</TonedChip> : r.inInbox ? <TonedChip tone="blue">Inbox</TonedChip> : <TonedChip tone="ink">Archived</TonedChip>}
          </li>
        ))}
      </ul>
      {error ? <p className="m-0 mt-2 text-sm text-muted">{error}</p> : null}
      {loading ? <p className="m-0 mt-2 flex items-center gap-2 text-sm text-muted"><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Reading from Gmail…</p> : null}
      {!loading && remaining > 0 ? <button type="button" className="btn btn-sm mt-3" onClick={() => load(rows.length, 30)}>Show {Math.min(remaining, 30)} more · {remaining} left</button> : null}
    </div>
  );
}
