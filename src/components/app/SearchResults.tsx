"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Bookmark, Check, ExternalLink, Inbox, MailOpen, Star, Trash2, Undo2 } from "lucide-react";
import type { CompiledQuery } from "@/lib/search/compile";
import { usd, when } from "@/lib/format";

type Result = { id: string; threadId: string; from: string; subject: string; date: string | null; snippet: string; unread: boolean; starred: boolean; inInbox: boolean; labels: string[]; signals: { relevance?: number; needsReply?: number; human?: number; disposable?: number } | null };
type Response = { compiled: CompiledQuery | null; gmail: string; total: number; results: Result[]; dropped: number; cost: { inputTokens: number; usd: number }; error?: string };

function Pct({ v, label }: { v?: number; label: string }) {
  if (v === undefined) return null;
  const cls = v >= 0.7 ? "chip--accent" : v <= 0.3 ? "" : "chip--warn";
  return <span className={`chip ${cls}`} title={`${label}: ${Math.round(v * 100)}%`}>{label} {Math.round(v * 100)}%</span>;
}

export function SearchResults({ q }: { q: string }) {
  const router = useRouter();
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [rawMode, setRawMode] = useState(false);
  const [raw, setRaw] = useState("");

  async function run(body: { q?: string; gmail?: string }) {
    setLoading(true); setMsg(null); setSelected(new Set());
    const res = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, limit: 60 }) });
    const json = (await res.json()) as Response;
    setData(json); setRaw(json.gmail ?? ""); setLoading(false);
  }
  useEffect(() => {
    if (!q) return;
    const t = setTimeout(() => { void run({ q }); }, 0);
    return () => clearTimeout(t);
  }, [q]);

  const results = useMemo(() => data?.results ?? [], [data]);
  const allSelected = useMemo(() => results.length > 0 && results.every((r) => selected.has(r.id)), [results, selected]);
  function toggleAll() { setSelected(allSelected ? new Set() : new Set(results.map((r) => r.id))); }
  function toggle(id: string) { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); setSelected(n); }

  async function act(action: string, label?: string) {
    const ids = [...selected];
    if (!ids.length) return;
    if ((action === "trash") && !confirm(`Move ${ids.length} message${ids.length > 1 ? "s" : ""} to Trash? Recoverable for 30 days, and undoable from Runs.`)) return;
    setLoading(true);
    const res = await fetch("/api/messages/modify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action, label }) });
    const json = (await res.json()) as { runId?: string; messages?: number; error?: string };
    if (json.error) setMsg(json.error);
    else { setMsg(`${action === "trash" ? "Trashed" : action === "archive" ? "Archived" : "Updated"} ${json.messages} messages.`); setLastRun(json.runId ?? null); }
    setLoading(false);
    await run(rawMode ? { gmail: raw } : { q });
    router.refresh();
  }
  async function undo() {
    if (!lastRun) return;
    setLoading(true);
    await fetch(`/api/runs/${lastRun}/undo`, { method: "POST" });
    setLastRun(null); setMsg("Undone.");
    await run(rawMode ? { gmail: raw } : { q });
  }
  async function save() {
    if (!data?.gmail) return;
    const name = prompt("Name this search", q.slice(0, 60));
    if (!name) return;
    await fetch("/api/searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, naturalQuery: q, gmailQuery: data.gmail }) });
    setMsg("Saved."); router.refresh();
  }

  return (
    <div className="space-y-4">
      {data?.compiled ? (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="eyebrow mr-1">Understood as</span>
            {data.compiled.parts.map((p, i) => <span key={i} className={`chip ${p.source === "ai" ? "chip--accent" : ""}`}>{p.label}: {p.value}</span>)}
            {!data.compiled.parts.length ? <span className="text-sm text-muted">no constraints, searching everything</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">Gmail query</span>
            {rawMode ? (
              <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); run({ gmail: raw }); }}>
                <input className="input mono" value={raw} onChange={(e) => setRaw(e.target.value)} />
                <button className="btn" type="submit">Run</button>
                <button className="btn" type="button" onClick={() => { setRawMode(false); run({ q }); }}>Back</button>
              </form>
            ) : (
              <>
                <code className="mono rounded bg-surface px-2 py-1 text-[13px]">{data.gmail}</code>
                <button className="btn btn-sm" type="button" onClick={() => setRawMode(true)}>Edit</button>
                <button className="btn btn-sm" type="button" onClick={save}><Bookmark size={14} /> Save</button>
                <span className="ml-auto text-xs text-muted">{data.total} matched · Jev cost {usd(data.cost.usd)}{data.dropped ? ` · ${data.dropped} filtered out by signals` : ""}</span>
              </>
            )}
          </div>
        </div>
      ) : null}
      {data?.error ? <p className="card text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>{data.error.includes("refresh token") || data.error.includes("access token") ? "Gmail is not connected for this account. Reconnect from the dashboard." : data.error}</p> : null}

      {results.length ? (
        <div className="card p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allSelected} onChange={toggleAll} /> {selected.size ? `${selected.size} selected` : "Select all"}</label>
            <div className="flex flex-wrap gap-1.5">
              <button className="btn btn-sm" disabled={!selected.size || loading} onClick={() => act("archive")}><Archive size={14} /> Archive</button>
              <button className="btn btn-sm" disabled={!selected.size || loading} onClick={() => act("read")}><MailOpen size={14} /> Mark read</button>
              <button className="btn btn-sm" disabled={!selected.size || loading} onClick={() => act("star")}><Star size={14} /> Star</button>
              <button className="btn btn-sm" disabled={!selected.size || loading} onClick={() => act("inbox")}><Inbox size={14} /> To inbox</button>
              <button className="btn btn-sm btn-danger" disabled={!selected.size || loading} onClick={() => act("trash")}><Trash2 size={14} /> Trash</button>
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted">
              {msg ? <span className="flex items-center gap-1"><Check size={13} /> {msg}</span> : null}
              {lastRun ? <button className="btn btn-sm" onClick={undo}><Undo2 size={14} /> Undo</button> : null}
            </div>
          </div>
          <ul className="divide-y divide-line">
            {results.map((r) => (
              <li key={r.id} className={`flex gap-3 px-4 py-3 ${selected.has(r.id) ? "bg-accent-soft/40" : ""}`}>
                <input type="checkbox" className="mt-1.5" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className={`truncate text-[15px] ${r.unread ? "font-bold" : "font-medium"}`}>{r.subject}</span>
                    <span className="truncate text-[13px] text-muted">{r.from}</span>
                    <span className="ml-auto whitespace-nowrap text-xs text-muted">{r.date ? when(r.date) : ""}</span>
                  </div>
                  <p className="truncate text-[13px] text-muted">{r.snippet}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {r.labels.slice(0, 4).map((l) => <span key={l} className="chip">{l}</span>)}
                    {r.starred ? <span className="chip">starred</span> : null}
                    {r.inInbox ? null : <span className="chip">archived</span>}
                    <Pct v={r.signals?.relevance} label="relevant" />
                    <Pct v={r.signals?.needsReply} label="needs reply" />
                    <Pct v={r.signals?.human} label="human" />
                    <Pct v={r.signals?.disposable} label="disposable" />
                    <a className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-accent-deep" href={`https://mail.google.com/mail/u/0/#all/${r.threadId}`} target="_blank" rel="noreferrer">open <ExternalLink size={12} /></a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : data && !data.error && !loading ? <p className="card text-sm text-muted">Nothing matched. Try fewer constraints, or edit the Gmail query directly.</p> : null}
      {loading ? <p className="text-sm text-muted">Compiling your question with Jev, searching Gmail, ranking results…</p> : null}
    </div>
  );
}
