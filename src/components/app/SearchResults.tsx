"use client";
import { ConfirmButton } from "@/components/Confirm";
import { Bars, Meter } from "@/components/app/Bits";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArrowDownUp, Bookmark, Check, ChevronDown, ExternalLink, Inbox, MailOpen, Sparkles, Star, Tag, Trash2, Undo2 } from "lucide-react";
import type { CompiledQuery } from "@/lib/search/compile";
import type { Signals } from "@/lib/search/rerank";
import { num, pct, usd, when } from "@/lib/format";

type Result = {
  threadId: string; ids: string[]; matched: number; total: number | null; lastFromMe: boolean | null; participants: string[];
  from: string; subject: string; date: string | null; snippet: string; unread: number; latestUnread: boolean; starred: boolean; inInbox: boolean; labels: string[]; signals: Signals | null;
};
type Numbers = { total: number; capped: boolean; sampled: number; threads: number; unread: number; senders: { domain: string; count: number }[]; labels: { label: string; count: number }[] };
type Distribution = { signal: keyof Signals; likely: number; unsure: number; unlikely: number } | null;
type Response = { compiled: CompiledQuery | null; gmail: string; total: number; numbers?: Numbers; distribution?: Distribution; readState?: { unseen: number; seen: number }; primary?: keyof Signals | null; results: Result[]; dropped: number; excluded?: number; cost: { inputTokens: number; requests?: number; usd: number }; model?: string | null; error?: string };

const SIGNAL_LABEL: Record<keyof Signals, string> = { relevance: "relevant", needsReply: "needs my reply", waiting: "waiting on them", human: "human", disposable: "disposable", urgency: "urgent" };
const SIGNAL_ORDER: (keyof Signals)[] = ["needsReply", "waiting", "relevance", "urgency", "human", "disposable"];

function sender(from: string): { name: string; domain: string } {
  const email = from.match(/<([^>]+)>/)?.[1] ?? from.trim();
  const name = from.replace(/<[^>]+>/, "").replace(/["']/g, "").trim() || email.split("@")[0];
  return { name, domain: email.split("@")[1]?.toLowerCase() ?? "" };
}

/** How Jev read the question: every choice with its confidence, every leftover word with its role. */
function Reading({ c }: { c: CompiledQuery }) {
  const j = c.jev;
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] text-muted hover:text-ink">
        <Sparkles size={14} aria-hidden="true" /> how Jev read it <ChevronDown size={14} className="transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="mt-3 grid gap-4 border-t border-line pt-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="mb-1.5 font-bold">Category <span className="font-normal text-muted">· confidence {pct(j.category.confidence)}</span></div>
          <Bars rows={j.category.probabilities.map((p) => ({ label: p.label, value: p.p, hint: pct(p.p) }))} max={1} />
        </div>
        <div className="space-y-2">
          <div><span className="font-bold">When</span> <span className="text-muted">{j.timeWindow.choice.replace(/_/g, " ")}{j.timeWindow.source === "ai" ? ` · ${pct(j.timeWindow.confidence)}` : j.timeWindow.source === "rule" ? " · from your words" : ""}</span></div>
          {j.sender ? <div><span className="font-bold">Sender</span> <span className="text-muted">{j.sender.choice} · {pct(j.sender.confidence)}</span></div> : null}
          {j.terms.length ? (
            <div>
              <div className="font-bold">Leftover words</div>
              <div className="mt-1 flex flex-wrap gap-1.5">{j.terms.map((t) => <span key={t.term} className={`chip ${t.role === "kind" ? "" : "chip--accent"}`} title={`${t.role} · ${pct(t.confidence)}`}>{t.term} · {t.role} {pct(t.confidence)}</span>)}</div>
            </div>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <div className="font-bold">Intent</div>
          <Meter value={j.intents.reply} label="wants what I owe" width={60} />
          <br />
          <Meter value={j.intents.waiting} label="wants what they owe" width={60} />
          <br />
          <Meter value={j.intents.people} label="humans only" width={60} />
          <br />
          <Meter value={j.intents.count} label="wants a count" width={60} />
        </div>
        <div className="text-muted">
          <div className="font-bold text-ink">Then code</div>
          <p className="m-0 mt-1 leading-snug">Words you typed always win over the model. Who spoke last in a thread is read from Gmail, not judged. Everything below 12% on the main signal is left out.</p>
          {c.model ? <p className="m-0 mt-1">model {c.model}</p> : null}
        </div>
      </div>
    </details>
  );
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
  const [sort, setSort] = useState<"jev" | "newest">("jev");
  const [onlyLikely, setOnlyLikely] = useState(false);
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

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

  const primary = data?.primary ?? null;
  const results = useMemo(() => {
    let rows = data?.results ?? [];
    if (onlyLikely && primary) rows = rows.filter((r) => (r.signals?.[primary] ?? 0) >= 0.7);
    if (readFilter === "unread") rows = rows.filter((r) => r.latestUnread);
    if (readFilter === "read") rows = rows.filter((r) => !r.latestUnread);
    if (sort === "newest") rows = [...rows].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    return rows;
  }, [data, onlyLikely, primary, sort, readFilter]);
  const allSelected = useMemo(() => results.length > 0 && results.every((r) => selected.has(r.threadId)), [results, selected]);
  function toggleAll() { setSelected(allSelected ? new Set() : new Set(results.map((r) => r.threadId))); }
  function toggle(id: string) { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); setSelected(n); }
  const selectedMessageIds = useMemo(() => results.filter((r) => selected.has(r.threadId)).flatMap((r) => r.ids), [results, selected]);

  async function act(action: string, label?: string) {
    const ids = selectedMessageIds;
    if (!ids.length) return;
    setLoading(true);
    const res = await fetch("/api/messages/modify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action, label }) });
    const json = (await res.json()) as { runId?: string; messages?: number; error?: string };
    if (json.error) setMsg(json.error);
    else { setMsg(`${action === "trash" ? "Trashed" : action === "archive" ? "Archived" : action === "label" ? "Labeled" : "Updated"} ${json.messages} messages.`); setLastRun(json.runId ?? null); }
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
    const trimmed = name.trim();
    if (!trimmed) return;
    await fetch("/api/searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: trimmed, naturalQuery: q, gmailQuery: data.gmail }) });
    setNaming(false); setMsg("Saved."); router.refresh();
  }

  const n = data?.numbers;
  const countMode = Boolean(data?.compiled?.count);
  const aggregate = Boolean(data?.compiled?.intents?.aggregate);
  const dist = data?.distribution ?? null;
  const errorText = data?.error ? (data.error.includes("refresh token") || data.error.includes("access token") ? "Gmail is not connected for this account. Reconnect from the dashboard." : data.error) : null;
  const shownThreads = data?.results.length ?? 0;

  return (
    <div className="space-y-4">
      {loading && !data ? <p className="flex items-center gap-2 text-sm text-muted"><Sparkles size={14} className="animate-pulse" aria-hidden="true" /> Compiling with Jev, searching Gmail, reading threads, ranking…</p> : null}
      {errorText ? <p className="card text-sm" style={{ borderColor: "var(--ink)" }}>{errorText}</p> : null}

      {data && !errorText ? (
        <div className="card space-y-5">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <div className="display text-[clamp(40px,5vw,64px)] leading-none">{countMode ? `${num(data.total)}${n?.capped ? "+" : ""}` : num(shownThreads)}</div>
              <div className="mt-1 text-[13px] text-muted">
                {countMode ? "messages match" : `conversations · ${num(data.total)}${n?.capped ? "+" : ""} messages match`}
                {data.readState && !countMode ? ` · ${num(data.readState.unseen)} you haven't opened, ${num(data.readState.seen)} you have` : n && countMode ? ` · ${num(n.unread)} unread of ${num(n.sampled)} read` : ""}
                {data.excluded ? ` · ${num(data.excluded)} left out because you spoke last` : ""}
              </div>
            </div>
            {dist ? (
              <div className="min-w-[220px]">
                <div className="text-[12px] text-muted">{SIGNAL_LABEL[dist.signal]}</div>
                <div className="mt-1.5 flex h-3 overflow-hidden rounded-[3px] border border-ink" title={`likely ${dist.likely} · unsure ${dist.unsure} · unlikely ${dist.unlikely}`}>
                  <div style={{ width: `${(dist.likely / Math.max(1, dist.likely + dist.unsure + dist.unlikely)) * 100}%`, background: "var(--ink)" }} />
                  <div style={{ width: `${(dist.unsure / Math.max(1, dist.likely + dist.unsure + dist.unlikely)) * 100}%`, background: "repeating-linear-gradient(45deg, var(--ink) 0 2px, transparent 2px 5px)" }} />
                </div>
                <div className="mt-1 flex gap-3 text-[12px] text-muted"><span><b className="text-ink">{dist.likely}</b> likely</span><span><b className="text-ink">{dist.unsure}</b> unsure</span><span><b className="text-ink">{dist.unlikely}</b> unlikely</span></div>
              </div>
            ) : null}
            {n?.senders.length && (countMode || aggregate) ? (
              <div className="min-w-[260px] flex-1">
                <div className="mb-1.5 text-[12px] text-muted">top senders in the {num(n.sampled)} read</div>
                <Bars rows={n.senders.slice(0, aggregate ? 8 : 5).map((s) => ({ label: s.domain, value: s.count }))} />
              </div>
            ) : n?.senders.length ? (
              <div className="min-w-0">
                <div className="text-[12px] text-muted">top senders</div>
                <div className="mt-1 flex flex-wrap gap-1.5">{n.senders.slice(0, 6).map((s) => <span key={s.domain} className="chip">{s.domain} <b>{s.count}</b></span>)}</div>
              </div>
            ) : null}
            {n?.labels.length ? (
              <div className="min-w-0">
                <div className="text-[12px] text-muted">labels</div>
                <div className="mt-1 flex flex-wrap gap-1.5">{n.labels.slice(0, 6).map((l) => <span key={l.label} className="chip">{l.label} <b>{l.count}</b></span>)}</div>
              </div>
            ) : null}
          </div>

          {data.compiled ? (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-4 text-[13px]">
              <span className="text-muted">understood as</span>
              {data.compiled.parts.length ? data.compiled.parts.map((p, i) => (
                <span key={i} className={`chip ${p.source === "ai" ? "chip--accent" : ""}`} title={p.source === "ai" ? `Jev · ${p.confidence !== undefined ? pct(p.confidence) : ""}` : "from your words"}>
                  {p.label}: {p.value}{p.source === "ai" && p.confidence !== undefined ? <span className="opacity-70"> · {pct(p.confidence)}</span> : null}
                </span>
              )) : <span className="chip">everything</span>}
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
                <span className="ml-auto text-muted">Jev {usd(data.cost.usd)}{data.cost.requests ? ` · ${data.cost.requests} requests` : ""}{data.dropped ? ` · ${data.dropped} ruled out` : ""}</span>
              </>
            )}
          </div>
          {data.compiled ? <Reading c={data.compiled} /> : null}
        </div>
      ) : null}

      {results.length || (data?.results.length && (onlyLikely || readFilter !== "all")) ? (
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
              <ConfirmButton className="btn btn-sm" armedClassName="btn-primary btn-sm" disabled={!selected.size || loading} icon={<Trash2 size={13} aria-hidden="true" />} label="Trash" confirmLabel={`Trash ${selectedMessageIds.length} messages`} message="Gmail keeps them 30 days, undoable here." onConfirm={() => act("trash")} />
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="inline-flex overflow-hidden rounded-[4px] border border-line">
                {(["all", "unread", "read"] as const).map((f) => <button key={f} type="button" className={`px-2 py-1 text-[12px] ${readFilter === f ? "bg-ink text-page" : "text-muted hover:text-ink"}`} onClick={() => setReadFilter(f)}>{f}</button>)}
              </span>
              {primary ? <label className="flex items-center gap-1.5"><input type="checkbox" checked={onlyLikely} onChange={(e) => setOnlyLikely(e.target.checked)} /> only likely (≥70%)</label> : null}
              {primary ? <button className="btn btn-sm" type="button" onClick={() => setSort(sort === "jev" ? "newest" : "jev")}><ArrowDownUp size={13} /> {sort === "jev" ? "by Jev" : "newest"}</button> : null}
              {msg ? <span className="flex items-center gap-1"><Check size={13} /> {msg}</span> : null}
              {lastRun ? <button className="btn btn-sm" onClick={undo}><Undo2 size={13} /> Undo</button> : null}
            </div>
          </div>
          <ol className="m-0 list-none divide-y divide-line p-0">
            {results.map((r, i) => {
              const s = sender(r.from);
              const sig = r.signals ?? {};
              const order = primary ? [primary, ...SIGNAL_ORDER.filter((k) => k !== primary)] : SIGNAL_ORDER;
              return (
                <li key={r.threadId} className={`grid grid-cols-[28px_20px_minmax(0,1fr)_auto] gap-x-3 px-4 py-3 ${selected.has(r.threadId) ? "bg-surface" : ""}`}>
                  <span className="pt-0.5 text-right text-[12px] text-muted">{i + 1}</span>
                  <input type="checkbox" className="mt-1" checked={selected.has(r.threadId)} onChange={() => toggle(r.threadId)} />
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className={`truncate text-[14px] ${r.unread ? "font-bold" : "font-medium"}`}>{s.name}</span>
                      <span className="truncate text-[12px] text-muted">{s.domain}</span>
                      {r.latestUnread ? <span className="chip chip--accent" style={{ padding: "0 6px" }}>{r.unread > 1 ? `${r.unread} unread` : "unread"}</span> : <span className="chip" style={{ padding: "0 6px" }}>read</span>}
                    </div>
                    <div className={`truncate text-[14.5px] ${r.unread ? "font-bold" : ""}`}>{r.subject}</div>
                    <div className="truncate text-[13px] text-muted">{r.snippet}</div>
                    <div className="mt-1 text-[12px] text-muted">
                      {(r.total ?? r.matched) > 1 ? `${r.total ?? r.matched} messages` : "1 message"}
                      {r.lastFromMe !== null ? ` · last from ${r.lastFromMe ? "you" : "them"}` : ""}
                      {r.participants.length > 1 ? ` · ${r.participants.slice(0, 3).join(", ")}` : ""}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {order.map((k) => (sig[k] !== undefined ? <Meter key={k} value={sig[k]!} label={SIGNAL_LABEL[k]} strong={k === primary} /> : null))}
                      {r.labels.slice(0, 4).map((l) => <span key={l} className="chip">{l}</span>)}
                      {r.starred ? <span className="chip">starred</span> : null}
                      {!r.inInbox ? <span className="chip">archived</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 text-right">
                    <span className="whitespace-nowrap text-[12.5px] text-muted">{r.date ? when(r.date) : ""}</span>
                    <a className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink" href={`https://mail.google.com/mail/u/0/#all/${r.threadId}`} target="_blank" rel="noreferrer">open <ExternalLink size={11} /></a>
                  </div>
                </li>
              );
            })}
            {!results.length ? <li className="px-4 py-3 text-sm text-muted">Nothing matches these filters. Widen “only likely” or the read filter to see the rest.</li> : null}
          </ol>
        </div>
      ) : data && !errorText && !loading ? <p className="card text-sm text-muted">Nothing matched. Loosen the question, or edit the Gmail query.</p> : null}
    </div>
  );
}
