"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ChevronDown, Filter, Loader2, RefreshCw, Shuffle } from "lucide-react";
import { ConfirmButton } from "@/components/Confirm";
import { num } from "@/lib/format";

type Item = { id: string; labels: string[]; senders: string; reason?: string };
type Status = { manage: boolean; managed: number; wanted: number; toCreate: number; toRemove: number; adoptable: Item[]; kept: Item[]; conflicts: { sender: string }[]; error?: string };
type Sampled = { label: string; messages: number; samples?: { from: string; subject: string }[] };
type Reconcile = { runId: string | null; days: number; added: { label: string; messages: number }[]; removed: (Sampled & { to?: { route: string; messages: number }[] })[]; ambiguous?: Sampled[]; error?: string };

const preview = (s: string) => {
  const parts = s.split(/\s+OR\s+/i);
  return parts.length > 4 ? `${parts.slice(0, 4).join(", ")} and ${parts.length - 4} more` : parts.join(", ");
};

/**
 * Gmail's side of filing: whether the filters match the routes, which of your own filters can become routes, and
 * filing existing mail the way the routes would today. Every action here is a run with a receipt and an Undo.
 */
export function FiltersCard({ refreshKey, onPolicyChanged }: { refreshKey: number; onPolicyChanged: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; runId?: string | null } | null>(null);
  const [days, setDays] = useState(90);
  const [plan, setPlan] = useState<Reconcile | null>(null);

  const load = useCallback(() => fetch("/api/filters").then((r) => r.json()).then((d: Status) => setStatus(d)), []);
  useEffect(() => {
    let live = true;
    fetch("/api/filters").then((r) => r.json()).then((d: Status) => { if (live) setStatus(d); });
    return () => { live = false; };
  }, [refreshKey]);

  async function post<T>(path: string, body?: unknown): Promise<T & { error?: string }> {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return (await res.json()) as T & { error?: string };
  }
  async function sync() {
    setBusy("sync"); setMsg(null);
    const r = await post<{ runId: string | null; created: number; deleted: number }>("/api/filters/sync");
    setMsg(r.error ? { text: r.error } : { text: r.runId ? `Created ${r.created} filters, removed ${r.deleted}.` : "Gmail already matches your routes.", runId: r.runId });
    setBusy(null); void load();
  }
  async function adopt() {
    setBusy("adopt"); setMsg(null);
    const r = await post<{ runId: string | null; adopted: number; created: number; deleted: number; kept: number }>("/api/filters/adopt");
    setMsg(r.error ? { text: r.error } : { text: `Adopted ${r.adopted} filters as routes. Gmail now has ${r.created} new filters and ${r.deleted} fewer old ones.`, runId: r.runId });
    setBusy(null); onPolicyChanged(); void load();
  }
  async function reconcile(apply: boolean) {
    setBusy(apply ? "apply" : "preview"); setMsg(null);
    const r = await post<Reconcile>("/api/filters/reconcile", { days, apply });
    if (r.error) setMsg({ text: r.error });
    else if (apply) { setPlan(null); setMsg({ text: `Filed ${num(r.added.reduce((a, b) => a + b.messages, 0))} labels and removed ${num(r.removed.reduce((a, b) => a + b.messages, 0))}.`, runId: r.runId }); }
    else setPlan(r);
    setBusy(null);
  }

  if (!status) return <section className="card flex items-center gap-2 text-[13.5px] text-muted"><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Reading your Gmail filters…</section>;
  if (status.error) return <section className="card text-[13.5px] text-muted">{status.error}</section>;
  if (!status.manage) return <section className="card flex items-center gap-3 text-[13.5px] text-muted"><span className="tile" aria-hidden="true"><Filter size={20} strokeWidth={2.2} /></span>Mailroom is not managing your Gmail filters. Your routes are saved; turn management on in Filing to apply them.</section>;
  const drift = status.toCreate + status.toRemove;
  const planTotal = plan ? plan.added.reduce((a, b) => a + b.messages, 0) + plan.removed.reduce((a, b) => a + b.messages, 0) : 0;

  return (
    <section className="card space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="tile" aria-hidden="true"><Filter size={20} strokeWidth={2.2} /></span>
          <div>
            <h2 className="m-0 text-[15px] font-semibold tracking-normal">Gmail filters</h2>
            <p className="m-0 mt-0.5 text-[13.5px] text-muted">
              {drift ? `${num(status.managed)} of ${num(status.wanted)} in place · ${status.toCreate} to create, ${status.toRemove} to remove` : `All ${num(status.wanted)} in place`}
              {status.kept.length ? ` · ${status.kept.length} of yours left alone` : ""}
            </p>
          </div>
        </div>
        {drift ? <button type="button" className="btn btn-sm" disabled={busy !== null} onClick={sync}>{busy === "sync" ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={13} aria-hidden="true" />} Sync now</button> : null}
      </div>

      {status.adoptable.length ? (
        <div className="space-y-2 border-t border-line pt-4">
          <p className="m-0 text-[14px] font-semibold">{status.adoptable.length} of your own filters can become routes</p>
          <p className="m-0 text-[13px] text-muted">One system then owns filing: a policy change reaches every sender, overlaps resolve by rule, and Undo covers it.</p>
          <ul className="m-0 list-none space-y-1 p-0 text-[13px]">
            {status.adoptable.map((a) => <li key={a.id} className="flex flex-wrap gap-x-2"><span className="font-medium">{a.labels.filter((l) => !/^[A-Z_]+$/.test(l)).join(", ")}</span><span className="min-w-0 truncate font-mono text-[12px] text-muted">{preview(a.senders)}</span></li>)}
          </ul>
          <ConfirmButton className="btn-primary btn-sm" armedClassName="btn-danger btn-sm" label={`Adopt ${status.adoptable.length} filters`} confirmLabel="Adopt them" message="Creates Mailroom's filters first, then removes these. One Undo puts everything back." onConfirm={adopt} busy={busy === "adopt"} busyLabel="Adopting…" disabled={busy !== null} icon={<Shuffle size={13} aria-hidden="true" />} />
        </div>
      ) : null}

      {status.kept.length ? (
        <details className="group border-t border-line pt-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[13.5px] text-muted"><ChevronDown size={14} className="transition group-open:rotate-180" aria-hidden="true" /> {status.kept.length} of your filters do more than file mail, so Mailroom leaves them alone</summary>
          <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[13px]">
            {status.kept.map((k) => <li key={k.id}><span className="font-medium">{k.labels.join(", ") || "No label"}</span> <span className="text-muted">· {k.reason}</span></li>)}
          </ul>
        </details>
      ) : null}

      <div className="space-y-3 border-t border-line pt-4">
        <p className="m-0 text-[14px] font-semibold">File existing mail</p>
        <p className="m-0 text-[13px] text-muted">Filters only see new mail. This files recent mail the way your routes would today. Missing labels go on. A label comes off only where a filter Mailroom replaced could have put it and your routes now file the message elsewhere, so labels you or Jev applied stay. Nothing older than a category&apos;s trash age is newly filed into it.</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[13.5px]">Last
            <select className="input w-auto py-1 text-[13.5px]" style={{ minHeight: 34 }} value={days} onChange={(e) => { setDays(Number(e.target.value)); setPlan(null); }}>
              {[30, 90, 180, 365].map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </label>
          <button type="button" className="btn btn-sm" disabled={busy !== null} onClick={() => reconcile(false)}>{busy === "preview" ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null} Preview</button>
          {plan && planTotal ? <ConfirmButton className="btn-primary btn-sm" armedClassName="btn-danger btn-sm" label={`Apply ${num(planTotal)} changes`} confirmLabel="Apply" message="Recorded as a run. Undo reverses every label." onConfirm={() => reconcile(true)} busy={busy === "apply"} busyLabel="Filing…" disabled={busy !== null} /> : null}
        </div>
        {plan ? (
          planTotal ? (
            <div className="grid gap-3 text-[13px] sm:grid-cols-2">
              <div><p className="m-0 mb-1 text-muted">Labels to add</p><ul className="m-0 list-none space-y-0.5 p-0 font-mono text-[12.5px]">{plan.added.map((a) => <li key={a.label}>+ {a.label} <span className="text-muted">· {num(a.messages)}</span></li>)}{plan.added.length ? null : <li className="text-muted">none</li>}</ul></div>
              <div><p className="m-0 mb-1 text-muted">Labels to remove</p><ul className="m-0 list-none space-y-0.5 p-0 font-mono text-[12.5px]">{plan.removed.map((a) => (
                <li key={a.label}>− {a.label} <span className="text-muted">· {num(a.messages)}</span>
                  {a.samples?.length ? <span className="block truncate font-sans text-[12px] text-muted" title={a.samples.map((s) => `${s.from}: ${s.subject}`).join("\n")}>e.g. {a.samples.map((s) => s.from).join(", ")}</span> : null}
                  {a.to?.length ? (
                    <details className="font-sans text-[12px] text-muted">
                      <summary className="cursor-pointer">Where it goes now</summary>
                      <ul className="m-0 mt-1 list-none space-y-0.5 p-0 text-[12px]">{a.to.map((x) => <li key={x.route} className="truncate" title={x.route}><span className="num">{num(x.messages)}</span> · {x.route}</li>)}</ul>
                    </details>
                  ) : null}
                </li>
              ))}{plan.removed.length ? null : <li className="text-muted">none</li>}</ul></div>
            </div>
          ) : <p className="m-0 text-[13px] text-muted">The last {plan.days} days already match your routes.</p>
        ) : null}
        {plan?.ambiguous?.length ? (
          <p className="m-0 text-[12.5px] text-muted">
            Kept as they are, because their own route names the sender but its subject words did not match: {plan.ambiguous.map((a) => `${a.label} ${num(a.messages)}${a.samples?.length ? ` (e.g. ${a.samples[0].from}: ${a.samples[0].subject})` : ""}`).join("; ")}. Search for them to file by hand.
          </p>
        ) : null}
      </div>

      {msg ? (
        <p className="m-0 flex flex-wrap items-center gap-2 text-[13.5px]">{msg.text}
          {msg.runId ? <Link href={`/app/runs/${msg.runId}`} className="inline-flex items-center gap-1 underline">Receipt <ArrowRight size={13} aria-hidden="true" /></Link> : null}
        </p>
      ) : null}
    </section>
  );
}
