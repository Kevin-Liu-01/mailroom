"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Plus, Star, Trash2 } from "lucide-react";
import { CATEGORIES, type PolicyConfig } from "@/lib/policy/schema";
import { BUILTIN_ROUTES, compileRoutes, routeLabels, senderTokens, type FileCategory, type Route } from "@/lib/policy/routes";

const cats = CATEGORIES.filter((c) => c.label) as { id: FileCategory; label: string }[];
const labelOf = (id: FileCategory) => cats.find((c) => c.id === id)?.label ?? id;

/** Senders are stored as Gmail's "a OR b"; edited one per line. */
const toLines = (expr?: string) => senderTokens(expr).join("\n");
const fromLines = (text: string) => senderTokens(text.replace(/\n/g, " OR ")).join(" OR ") || undefined;

function RouteRow({ route, onChange, onRemove }: { route: Route; onChange: (r: Route) => void; onRemove: () => void }) {
  const [senders, setSenders] = useState(toLines(route.from));
  const count = senderTokens(route.from).length;
  return (
    <li className="space-y-3 border-b border-line py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto py-1.5 text-[13.5px]" style={{ minHeight: 36 }} value={route.category} onChange={(e) => onChange({ ...route, category: e.target.value as FileCategory })} aria-label="Category">
          {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <span className="text-muted">/</span>
        <input className="input w-44 py-1.5 text-[13.5px]" style={{ minHeight: 36 }} placeholder="Sub-label, optional" value={route.sub ?? ""} onChange={(e) => onChange({ ...route, sub: e.target.value.replace(/[/"]/g, "") || undefined })} aria-label="Sub-label" />
        <span className="font-mono text-[12px] text-muted">→ {routeLabels(route).join(" + ")}</span>
        <span className="ml-auto flex items-center gap-2">
          <button type="button" className={`btn btn-sm ${route.star ? "btn-primary" : ""}`} onClick={() => onChange({ ...route, star: !route.star || undefined })} aria-pressed={Boolean(route.star)} title="Star this mail, which also protects it from trash rules"><Star size={13} aria-hidden="true" /> Star</button>
          <button type="button" className="btn btn-sm" onClick={onRemove} aria-label="Remove route"><Trash2 size={13} aria-hidden="true" /></button>
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="block space-y-1 text-[13px]">
          <span className="text-muted">Senders, one per line{count ? ` · ${count}` : ""}</span>
          <textarea className="input font-mono h-24 py-2 text-[12.5px]" placeholder={"uber.com\nreceipts@lyft.com"} value={senders}
            onChange={(e) => { setSenders(e.target.value); onChange({ ...route, from: fromLines(e.target.value) }); }} />
        </label>
        <label className="block space-y-1 text-[13px]">
          <span className="text-muted">Only if the subject has</span>
          <input className="input py-1.5 text-[13px]" style={{ minHeight: 36 }} placeholder='receipt OR "your order"' value={route.subject ?? ""} onChange={(e) => onChange({ ...route, subject: e.target.value || undefined })} />
          <span className="text-[12px] text-muted">Leave empty for all mail from these senders.</span>
        </label>
        <label className="block space-y-1 text-[13px]">
          <span className="text-muted">Except if the subject has</span>
          <input className="input py-1.5 text-[13px]" style={{ minHeight: 36 }} placeholder="code OR password" value={route.except ?? ""} onChange={(e) => onChange({ ...route, except: e.target.value || undefined })} />
        </label>
      </div>
    </li>
  );
}

/**
 * Filing: your routes (where mail from a sender goes), the built-in routes with an off switch each, and any
 * conflicts. Overlaps are resolved by rule when the filters compile; only true conflicts are shown here.
 */
export function RoutesEditor({ policy, onChange }: { policy: PolicyConfig; onChange: (filing: PolicyConfig["filing"]) => void }) {
  const { routes, builtinsOff } = policy.filing;
  const compiled = useMemo(() => compileRoutes(policy), [policy]);
  const [keys, setKeys] = useState(() => routes.map((_, i) => i));
  const [nextKey, setNextKey] = useState(routes.length);
  const set = (next: Route[]) => onChange({ ...policy.filing, routes: next });
  const grouped = useMemo(() => cats.map((c) => ({ cat: c, routes: BUILTIN_ROUTES.filter((b) => b.category === c.id) })).filter((g) => g.routes.length), []);

  return (
    <div className="space-y-5">
      <label className="flex items-start gap-2.5 text-[13.5px]">
        <input type="checkbox" className="mt-0.5 size-4" checked={policy.filing.manage} onChange={(e) => onChange({ ...policy.filing, manage: e.target.checked })} />
        <span><span className="font-semibold">Let Mailroom manage my Gmail filters</span><span className="block text-muted">Off keeps your routes but never creates, changes, or removes a filter. Search, trash, and Jev still work.</span></span>
      </label>
      {compiled.conflicts.length ? (
        <div className="card space-y-1.5 border-ink p-4 text-[13.5px]">
          <p className="m-0 flex items-center gap-2 font-semibold"><AlertTriangle size={15} aria-hidden="true" /> {compiled.conflicts.length === 1 ? "One sender is" : `${compiled.conflicts.length} senders are`} filed into two categories</p>
          <ul className="m-0 list-none space-y-0.5 p-0 text-muted">
            {compiled.conflicts.map((c) => <li key={c.sender}><span className="font-mono text-ink">{c.sender}</span> goes to {c.categories.map(labelOf).join(" and ")}. Remove it from one.</li>)}
          </ul>
        </div>
      ) : null}

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="m-0 text-[14px] font-semibold">Your routes <span className="font-normal text-muted">· {routes.length}</span></p>
          <button type="button" className="btn btn-sm" onClick={() => { set([...routes, { category: "receipts", from: undefined }]); setKeys([...keys, nextKey]); setNextKey(nextKey + 1); }}><Plus size={13} aria-hidden="true" /> Add a route</button>
        </div>
        {routes.length ? (
          <ul className="m-0 list-none p-0">
            {routes.map((r, i) => (
              <RouteRow key={keys[i] ?? `r${i}`} route={r}
                onChange={(next) => set(routes.map((x, j) => (j === i ? next : x)))}
                onRemove={() => { set(routes.filter((_, j) => j !== i)); setKeys(keys.filter((_, j) => j !== i)); }} />
            ))}
          </ul>
        ) : <p className="m-0 mt-2 text-[13.5px] text-muted">None yet. Add one, or adopt the filters you already have in Gmail below.</p>}
        <p className="m-0 mt-2 text-[12.5px] text-muted">Your routes win over the built-in ones. A more specific sender always wins, and a route with subject words keeps that slice of a sender&apos;s mail.</p>
      </div>

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[14px] font-semibold">
          <ChevronDown size={15} className="transition group-open:rotate-180" aria-hidden="true" /> Built-in routes <span className="font-normal text-muted">· {BUILTIN_ROUTES.length - builtinsOff.length} of {BUILTIN_ROUTES.length} on</span>
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {grouped.map(({ cat, routes: bs }) => (
            <div key={cat.id} className="card space-y-2 p-4">
              <p className="m-0 text-[13.5px] font-semibold">{cat.label}</p>
              <ul className="m-0 list-none space-y-2 p-0">
                {bs.map((b) => {
                  const on = !builtinsOff.includes(b.id);
                  const n = senderTokens(b.from).length;
                  return (
                    <li key={b.id} className="flex items-start gap-2.5 text-[13px]">
                      <input type="checkbox" className="mt-0.5 size-4" checked={on} aria-label={`${b.name} on`}
                        onChange={() => onChange({ ...policy.filing, builtinsOff: on ? [...builtinsOff, b.id] : builtinsOff.filter((x) => x !== b.id) })} />
                      <span className="min-w-0">
                        <span className={on ? "" : "text-muted line-through"}>{b.name}</span>
                        <span className="block truncate font-mono text-[11.5px] text-muted" title={b.from ?? b.subject}>
                          {n ? `${n} senders: ${senderTokens(b.from).slice(0, 4).join(", ")}${n > 4 ? ", …" : ""}` : `subject: ${b.subject?.slice(0, 60)}…`}{b.subject && n ? " · only receipts" : ""}{b.except ? " · not account mail" : ""}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
