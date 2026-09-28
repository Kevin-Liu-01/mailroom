"use client";
import { ConfirmButton } from "@/components/Confirm";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Bookmark, Check, ExternalLink, Inbox, MailOpen, Star, Tag, Trash2, Undo2 } from "lucide-react";
import type { CompiledQuery } from "@/lib/search/compile";
import { num, pct, usd, when } from "@/lib/format";

type Result = { id: string; threadId: string; from: string; subject: string; date: string | null; snippet: string; unread: boolean; starred: boolean; inInbox: boolean; labels: string[]; signals: { relevance?: number; needsReply?: number; human?: number; disposable?: number } | null };
type Numbers = { total: number; capped: boolean; sampled: number; unread: number; senders: { domain: string; count: number }[]; labels: { label: string; count: number }[] };
type Response = { compiled: CompiledQuery | null; gmail: string; total: number; numbers?: Numbers; results: Result[]; dropped: number; cost: { inputTokens: number; usd: number }; error?: string };

function sender(from: string): { name: string; domain: string } {
  const email = from.match(/<([^>]+)>/)?.[1] ?? from.trim();
  const name = from.replace(/<[^>]+>/, "").replace(/["']/g, "").trim() || email.split("@")[0];
  return { name, domain: email.split("@")[1]?.toLowerCase() ?? "" };
}

function Signal({ v, label }: { v?: number; label: string }) {
  if (v === undefined) return null;
  return <span className={`chip ${v >= 0.7 ? "chip--accent" : ""}`} title={`${label}: ${pct(v)}`}>{label} {pct(v)}</span>;
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
  const [labelName, setLabelName] = useState("");

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
    setLoading(true);
    const res = await fetch("/api/messages/modify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action, label }) });
    const json = (await res.json()) as { runId?: string; messages?: number; error?: string };
    if (json.error) setMsg(json.error);
    else { setMsg(`${action === "trash" ? "Trashed" : action === "archive" ? "Archived" : action === "label" ? "Labeled" : "Updated"} ${json.messages}.`); setLastRun(json.runId ?? null); }
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
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  async function save() {
    if (!data?.gmail) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    await fetch("/api/searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: trimmed, naturalQuery: q, gmailQuery: data.gmail }) });
    setNaming(false); setMsg("Saved."); router.refresh();
  }

  const n = data?.numbers;
  const countMode = Boolean(data?.compiled?.count);
  const errorText = data?.error ? (data.error.includes("refresh token") || data.error.includes("access token") ? "Gmail is not connected for this account. Reconnect from the dashboard." : data.error) : null;

  return (
    <div className="space-y-4">
      {loading && !data ? <p className="text-sm text-muted">Compiling with Jev, searching Gmail, ranking…</p> : null}
      {errorText ? <p className="card text-sm" style={{ borderColor: "var(--ink)" }}>{errorText}</p> : null}

      {data && !errorText ? (
        <div className="card space-y-5">
          {/* The answer, in numbers */}
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <div className="display text-[clamp(40px,5vw,64px)] leading-none">{n ? `${num(n.total)}${n.capped ? "+" : ""}` : num(data.total)}</div>
              <div className="mt-1 text-[13px] text-muted">{countMode ? "messages match" : "matched"}{n && n.sampled ? ` · ${num(n.unread)} unread of the ${num(n.sampled)} shown` : ""}</div>
            </div>
            {n?.senders.length ? (
              <div className="min-w-0">
                <div className="text-[12px] text-muted">top senders</div>
                <div className="mt-1 flex flex-wrap gap-1.5">{n.senders.map((s) => <span key={s.domain} className="chip">{s.domain} <b>{s.count}</b></span>)}</div>
              </div>
            ) : null}
            {n?.labels.length ? (
              <div className="min-w-0">
                <div className="text-[12px] text-muted">labels</div>
                <div className="mt-1 flex flex-wrap gap-1.5">{n.labels.map((l) => <span key={l.label} className="chip">{l.label} <b>{l.count}</b></span>)}</div>
              </div>
            ) : null}
          </div>

          {data.compiled ? (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-4 text-[13px]">
              <span className="text-muted">understood as</span>
              {data.compiled.parts.length ? data.compiled.parts.map((p, i) => <span key={i} className={`chip ${p.source === "ai" ? "chip--accent" : ""}`}>{p.label}: {p.value}</span>) : <span className="chip">everything</span>}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-muted">gmail</span>
            {rawMode ? (
              <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); run({ gmail: raw }); }}>
                <input className="input" style={{ minHeight: 36 }} value={raw} onChange={(e) => setRaw(e.target.value)} />
                <button className="btn btn-sm" type="submit">Run</button>
                <button className="btn btn-sm" type="button" onClick={() => { setRawMode(false); run({ q }); }}>Back</button>
              </form>
            ) : (
              <>
                <code className="rounded bg-surface px-2 py-1">{data.gmail}</code>
                <button className="btn btn-sm" type="button" onClick={() => setRawMode(true)}>Edit</button>
                {naming ? (
                  <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void save(); }}>
                    <input className="input" style={{ minHeight: 32, width: 220, fontSize: 12.5 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="name this search" autoFocus />
                    <button className="btn-primary btn-sm" type="submit" disabled={!name.trim()}>Save</button>
                    <button className="btn btn-sm" type="button" onClick={() => setNaming(false)}>Cancel</button>
                  </form>
                ) : (
                  <button className="btn btn-sm" type="button" onClick={() => { setName(q.slice(0, 60)); setNaming(true); }}><Bookmark size={13} /> Save</button>
                )}
                <span className="ml-auto text-muted">Jev {usd(data.cost.usd)}{data.dropped ? ` · ${data.dropped} filtered out` : ""}</span>
              </>
            )}
          </div>
        </div>
      ) : null}

      {results.length ? (
        <div className="card p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allSelected} onChange={toggleAll} /> {selected.size ? `${selected.size} selected` : "select all"}</label>
            <div className="flex flex-wrap items-center gap-1.5">
              <button className="btn btn-sm" disabled={!selected.size || loading} onClick={() => act("archive")}><Archive size={13} /> Archive</button>
              <button className="btn btn-sm" disabled={!selected.size || loading} onClick={() => act("read")}><MailOpen size={13} /> Read</button>
              <button className="btn btn-sm" disabled={!selected.size || loading} onClick={() => act("star")}><Star size={13} /> Star</button>
              <button className="btn btn-sm" disabled={!selected.size || loading} onClick={() => act("inbox")}><Inbox size={13} /> Inbox</button>
              <span className="inline-flex items-center gap-1">
                <input className="input" style={{ minHeight: 32, width: 150, padding: "2px 8px", fontSize: 12.5 }} placeholder="label name" value={labelName} onChange={(e) => setLabelName(e.target.value)} />
                <button className="btn btn-sm" disabled={!selected.size || loading || !labelName.trim()} onClick={() => act("label", labelName.trim())}><Tag size={13} /> Label</button>
              </span>
              <ConfirmButton className="btn btn-sm" armedClassName="btn-primary btn-sm" disabled={!selected.size || loading} icon={<Trash2 size={13} aria-hidden="true" />} label="Trash" confirmLabel={`Trash ${selected.size}`} message="Gmail keeps them 30 days, undoable here." onConfirm={() => act("trash")} />
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted">
              {msg ? <span className="flex items-center gap-1"><Check size={13} /> {msg}</span> : null}
              {lastRun ? <button className="btn btn-sm" onClick={undo}><Undo2 size={13} /> Undo</button> : null}
            </div>
          </div>
          <ol className="divide-y divide-line">
            {results.map((r, i) => {
              const s = sender(r.from);
              return (
                <li key={r.id} className={`grid grid-cols-[28px_20px_minmax(0,1fr)_auto] gap-x-3 px-4 py-3 ${selected.has(r.id) ? "bg-surface" : ""}`}>
                  <span className="pt-0.5 text-right text-[12px] text-muted">{i + 1}</span>
                  <input type="checkbox" className="mt-1" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className={`truncate text-[14px] ${r.unread ? "font-bold" : "font-medium"}`}>{s.name}</span>
                      <span className="truncate text-[12px] text-muted">{s.domain}</span>
                      {r.unread ? <span className="chip chip--accent" style={{ padding: "0 6px" }}>unread</span> : null}
                    </div>
                    <div className={`truncate text-[14.5px] ${r.unread ? "font-bold" : ""}`}>{r.subject}</div>
                    <div className="truncate text-[13px] text-muted">{r.snippet}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {r.labels.slice(0, 4).map((l) => <span key={l} className="chip">{l}</span>)}
                      {r.starred ? <span className="chip">starred</span> : null}
                      {!r.inInbox ? <span className="chip">archived</span> : null}
                      <Signal v={r.signals?.relevance} label="relevant" />
                      <Signal v={r.signals?.needsReply} label="needs reply" />
                      <Signal v={r.signals?.human} label="human" />
                      <Signal v={r.signals?.disposable} label="disposable" />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 text-right">
                    <span className="whitespace-nowrap text-[12.5px] text-muted">{r.date ? when(r.date) : ""}</span>
                    <a className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink" href={`https://mail.google.com/mail/u/0/#all/${r.threadId}`} target="_blank" rel="noreferrer">open <ExternalLink size={11} /></a>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : data && !errorText && !loading ? <p className="card text-sm text-muted">Nothing matched. Loosen the question, or edit the Gmail query.</p> : null}
    </div>
  );
}
