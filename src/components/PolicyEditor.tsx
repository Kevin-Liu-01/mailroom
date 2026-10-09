"use client";
import { useHideEmails } from "@/components/app/Privacy";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CATEGORIES, type CategoryId, type PolicyConfig } from "@/lib/policy/schema";
import type { Rule } from "@/lib/policy/rules";
import { RoutesEditor } from "@/components/RoutesEditor";
import { FiltersCard } from "@/components/FiltersCard";

type Api = { policy: PolicyConfig; scheduleEnabled: boolean; rules: Rule[]; error?: string };
const cats = CATEGORIES.filter((c) => c.label) as { id: CategoryId; label: string; description: string }[];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4">
      <div><h2 className="font-medium">{title}</h2>{hint ? <p className="text-sm text-muted">{hint}</p> : null}</div>
      {children}
    </section>
  );
}

function CategoryPicker({ label, value, onChange }: { label: string; value: CategoryId[]; onChange: (v: CategoryId[]) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => {
          const on = value.includes(c.id);
          return (
            <button key={c.id} type="button" onClick={() => onChange(on ? value.filter((v) => v !== c.id) : [...value, c.id])}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${on ? "border-accent bg-accent-soft" : "border-line text-muted hover:border-accent"}`}>
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Days({ label, value, onChange, allowOff }: { label: string; value: number | null; onChange: (v: number | null) => void; allowOff?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        {allowOff ? <input type="checkbox" checked={value !== null} onChange={(e) => onChange(e.target.checked ? 30 : null)} /> : null}
        <input type="number" min={1} max={3650} className="w-20 rounded border border-line bg-page px-2 py-1 text-right" disabled={value === null}
          value={value ?? ""} onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))} />
        <span className="w-9 text-muted">days</span>
      </span>
    </label>
  );
}

function Num({ label, value, onChange, step = 0.05, min = 0, max = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <input type="number" step={step} min={min} max={max} className="w-24 rounded border border-line bg-page px-2 py-1 text-right" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Lines({ label, hint, value, onChange }: { label: string; hint: string; value: string[]; onChange: (v: string[]) => void }) {
  const hidden = useHideEmails();
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <textarea className={`mono h-28 w-full rounded border border-line bg-page p-2 text-xs ${hidden ? "blur-[5px]" : ""}`} value={value.join("\n")} placeholder={hint}
        onChange={(e) => onChange(e.target.value.split(/\n|,/).map((s) => s.trim()).filter(Boolean))} />
    </label>
  );
}

export function PolicyEditor() {
  const hidden = useHideEmails();
  const [data, setData] = useState<Api | null>(null);
  const [policy, setPolicy] = useState<PolicyConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ domain: string; count: number }[] | null>(null);
  // Bumped when the policy is reloaded from the server (after adopting filters), so editors remount with fresh rows.
  const [version, setVersion] = useState(0);
  const [savedAt, setSavedAt] = useState(0);

  const apply = useCallback((d: Api) => { setData(d); setPolicy(d.policy); setVersion((v) => v + 1); }, []);
  const load = useCallback(() => fetch("/api/policy").then((r) => r.json()).then(apply), [apply]);
  useEffect(() => {
    let live = true;
    fetch("/api/policy").then((r) => r.json()).then((d: Api) => { if (live) apply(d); });
    return () => { live = false; };
  }, [apply]);

  const dirty = useMemo(() => data && policy && JSON.stringify(data.policy) !== JSON.stringify(policy), [data, policy]);

  async function save() {
    if (!policy) return;
    setSaving(true); setMsg(null);
    // A route left blank is a row being typed, not a rule: drop it rather than fail the save.
    const clean = { ...policy, filing: { ...policy.filing, routes: policy.filing.routes.filter((r) => r.from || r.subject) } };
    const res = await fetch("/api/policy", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ policy: clean }) });
    const d = (await res.json()) as Api;
    if (res.ok) { setData({ ...d, scheduleEnabled: data?.scheduleEnabled ?? true }); setPolicy(d.policy); setSavedAt(Date.now()); setMsg("Saved. The next run uses this policy; sync the filters below to apply routes now."); }
    else setMsg(d.error ?? "Could not save");
    setSaving(false);
  }

  async function suggest() {
    setSuggesting(true);
    const res = await fetch("/api/senders");
    const d = (await res.json()) as { suggestions?: { domain: string; count: number }[]; error?: string };
    setSuggestions(d.suggestions ?? []);
    if (d.error) setMsg(d.error);
    setSuggesting(false);
  }

  if (!policy) return <p className="text-sm text-muted">Loading policy…</p>;
  const set = (patch: Partial<PolicyConfig>) => setPolicy({ ...policy, ...patch });

  return (
    <div className="space-y-6">
      <Section title="Categories" hint="Which buckets leave the inbox on arrival, which never count as important, and which can never be trashed by any rule.">
        <CategoryPicker label="Skip the inbox (labeled, archived, searchable)" value={policy.categories.skipInbox} onChange={(v) => set({ categories: { ...policy.categories, skipInbox: v } })} />
        <CategoryPicker label="Never important" value={policy.categories.neverImportant} onChange={(v) => set({ categories: { ...policy.categories, neverImportant: v } })} />
        <CategoryPicker label="Protected from trash rules" value={policy.categories.protected} onChange={(v) => set({ categories: { ...policy.categories, protected: v } })} />
      </Section>

      <Section title="Filing" hint="Routes say where mail from a sender goes. Each one becomes a Gmail filter, so new mail is filed the moment it lands.">
        <RoutesEditor key={version} policy={policy} onChange={(filing) => set({ filing })} />
      </Section>

      <FiltersCard refreshKey={savedAt} onPolicyChanged={load} />

      <Section title="Aging" hint="Days before the daily run archives, trashes (30-day recovery), or marks read. Uncheck to turn a trash rule off.">
        <div className="grid gap-2 sm:grid-cols-2">
          <Days label="Archive skip-inbox stragglers after" value={policy.aging.archiveStragglersAfterDays} onChange={(v) => set({ aging: { ...policy.aging, archiveStragglersAfterDays: v ?? 2 } })} />
          <Days label="Trash security codes after" allowOff value={policy.aging.trashSecurityCodesAfterDays} onChange={(v) => set({ aging: { ...policy.aging, trashSecurityCodesAfterDays: v } })} />
          <Days label="Trash dev notifications after" allowOff value={policy.aging.trashDevAfterDays} onChange={(v) => set({ aging: { ...policy.aging, trashDevAfterDays: v } })} />
          <Days label="Trash social notifications after" allowOff value={policy.aging.trashSocialAfterDays} onChange={(v) => set({ aging: { ...policy.aging, trashSocialAfterDays: v } })} />
          <Days label="Trash marketing after (off keeps the Promotions tab)" allowOff value={policy.aging.trashMarketingAfterDays} onChange={(v) => set({ aging: { ...policy.aging, trashMarketingAfterDays: v } })} />
          <Days label="Mark promotions read after" allowOff value={policy.aging.markReadPromotionsAfterDays} onChange={(v) => set({ aging: { ...policy.aging, markReadPromotionsAfterDays: v } })} />
          <Days label="Mark social read after" allowOff value={policy.aging.markReadSocialAfterDays} onChange={(v) => set({ aging: { ...policy.aging, markReadSocialAfterDays: v } })} />
          <Days label="Mark updates read after" allowOff value={policy.aging.markReadUpdatesAfterDays} onChange={(v) => set({ aging: { ...policy.aging, markReadUpdatesAfterDays: v } })} />
          <Num label="Refuse a trash rule above this many messages" value={policy.aging.maxTrashPerRule} step={100} min={0} max={50000} onChange={(v) => set({ aging: { ...policy.aging, maxTrashPerRule: Math.round(v) } })} />
        </div>
      </Section>

      <Section title="Senders" hint="One domain per line. Heavy promotional senders get the Marketing label and lose the important marker; work and family senders are always important.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Lines label="Heavy promotional senders" hint="em.target.com&#10;email.chipotle.com" value={policy.senders.heavyPromo} onChange={(v) => set({ senders: { ...policy.senders, heavyPromo: v } })} />
            <button type="button" className="btn py-1 text-xs" disabled={suggesting} onClick={suggest}>{suggesting ? "Sampling your Promotions tab…" : "Suggest from my Promotions"}</button>
            {suggestions ? (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.filter((s) => !policy.senders.heavyPromo.includes(s.domain)).map((s) => (
                  <button key={s.domain} type="button" className="rounded-full border border-border px-2 py-0.5 text-xs hover:border-accent" onClick={() => set({ senders: { ...policy.senders, heavyPromo: [...policy.senders.heavyPromo, s.domain] } })}>
                    {s.domain} <span className="text-muted">×{s.count}</span>
                  </button>
                ))}
                {suggestions.length === 0 ? <span className="text-xs text-muted">No promotions in the last 90 days.</span> : null}
              </div>
            ) : null}
          </div>
          <Lines label="Work domains" hint="mycompany.com" value={policy.senders.work} onChange={(v) => set({ senders: { ...policy.senders, work: v } })} />
          <Lines label="Family and friends" hint="mom@gmail.com&#10;dad@gmail.com" value={policy.senders.family} onChange={(v) => set({ senders: { ...policy.senders, family: v } })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Lines label="Protected senders (never trashed or archived by any rule or AI decision)" hint="landlord@example.com&#10;accountant.co" value={policy.senders.protected} onChange={(v) => set({ senders: { ...policy.senders, protected: v } })} />
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Per-sender trash schedule (domain and days, one per line)</span>
            <textarea className={`mono h-28 w-full rounded border border-line bg-page p-2 text-xs ${hidden ? "blur-[5px]" : ""}`} placeholder="em.target.com 30&#10;news.arcteryx.com 1"
              value={Object.entries(policy.senders.trashAfterDays).map(([d, n]) => `${d} ${n}`).join("\n")}
              onChange={(e) => { const next: Record<string, number> = {}; for (const line of e.target.value.split("\n")) { const [d, n] = line.trim().split(/\s+/); if (d && d.length >= 3) next[d] = Math.max(1, Number(n) || 30); } set({ senders: { ...policy.senders, trashAfterDays: next } }); }} />
            <span className="text-xs text-muted">The Senders and Trash pages write these for you; edit here to change a number.</span>
          </label>
        </div>
      </Section>

      <Section title="AI triage (TypeSafe Jev)" hint="Only Primary-tab mail that no rule placed is judged, once, from metadata. Thresholds are probabilities from 0 to 1.">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.ai.enabled} onChange={(e) => set({ ai: { ...policy.ai, enabled: e.target.checked } })} /> Enabled</label>
        <div className="grid gap-2 sm:grid-cols-2">
          <Num label="Look back (days)" value={policy.ai.lookbackDays} step={1} min={1} max={365} onChange={(v) => set({ ai: { ...policy.ai, lookbackDays: Math.round(v) } })} />
          <Num label="Max messages per run" value={policy.ai.maxMessagesPerRun} step={50} min={0} max={2000} onChange={(v) => set({ ai: { ...policy.ai, maxMessagesPerRun: Math.round(v) } })} />
          <Num label="Label when category confidence ≥" value={policy.ai.labelConfidence} onChange={(v) => set({ ai: { ...policy.ai, labelConfidence: v } })} />
          <Num label="Archive automated mail when probability ≥" value={policy.ai.archiveAutomatedThreshold} onChange={(v) => set({ ai: { ...policy.ai, archiveAutomatedThreshold: v } })} />
          <Num label="Flag Action Needed when probability ≥" value={policy.ai.flagActionThreshold} onChange={(v) => set({ ai: { ...policy.ai, flagActionThreshold: v } })} />
          <Num label="Budget per run (USD)" value={policy.ai.budgetUsdPerRun} step={0.05} min={0} max={50} onChange={(v) => set({ ai: { ...policy.ai, budgetUsdPerRun: v } })} />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.ai.archiveAutomated} onChange={(e) => set({ ai: { ...policy.ai, archiveAutomated: e.target.checked } })} /> Archive confident automated mail out of Primary</label>
        <CategoryPicker label="Categories the AI may archive" value={policy.ai.archiveCategories} onChange={(v) => set({ ai: { ...policy.ai, archiveCategories: v } })} />
      </Section>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel p-3 shadow-lg">
        <span className="text-sm text-muted">{msg ?? (dirty ? "Unsaved changes" : "Saved policy")}</span>
        <div className="flex gap-2">
          <button className="btn" type="button" disabled={!dirty} onClick={() => data && setPolicy(data.policy)}>Reset</button>
          <button className="btn-primary" type="button" disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : "Save policy"}</button>
        </div>
      </div>

      {data?.rules?.length ? (
        <Section title="Resulting daily rules" hint="Exactly what the engine will search for and change. Paste any query into Gmail search to see what it matches.">
          <ul className="space-y-1 text-xs">
            {data.rules.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-2"><span className="mono rounded bg-accent-soft px-1.5">{r.kind}</span><span className="mono">{r.query}</span></li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
