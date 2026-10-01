"use client";
import { useState } from "react";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import type { KeySource } from "@/lib/ai/client";

/**
 * Bring your own TypeSafe key. Shows which key is in use (yours, or the house key on the owner account), takes a
 * new one after a live check against TypeSafe, and removes it. The key is stored encrypted and never shown again.
 */
export function KeyCard({ initial }: { initial: { hasKey: boolean; source: KeySource | null; last4: string | null } }) {
  const [state, setState] = useState(initial);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: value }) });
    const json = (await res.json()) as { ok?: boolean; last4?: string; error?: string };
    if (json.ok) { setState({ hasKey: true, source: "own", last4: json.last4 ?? null }); setValue(""); setMsg("Key saved. Jev is on."); }
    else setMsg(json.error ?? "Could not save the key.");
    setBusy(false);
  }
  async function remove() {
    setBusy(true); setMsg(null);
    await fetch("/api/key", { method: "DELETE" });
    setState({ hasKey: false, source: null, last4: null }); setMsg("Key removed. Rules still run; Jev is off.");
    setBusy(false);
  }

  return (
    <section className={`card space-y-3 ${state.hasKey ? "" : "border-ink"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="tile" aria-hidden="true"><KeyRound size={20} strokeWidth={2.2} /></span>
          <div>
            <h2 className="m-0 text-[15px] font-semibold tracking-normal">Your TypeSafe key</h2>
            <p className="m-0 mt-0.5 text-[13.5px] text-muted">
              {state.source === "own" ? <>Using your key ending in <span className="font-mono">{state.last4}</span>.</>
                : state.source === "house" ? "Using the house key on this account."
                : "Jev is off until you add one. Rules run without it."}
            </p>
          </div>
        </div>
        {state.source === "own" ? (
          <button type="button" className="btn btn-sm" disabled={busy} onClick={remove}><Trash2 size={13} aria-hidden="true" /> Remove key</button>
        ) : null}
      </div>
      {state.source !== "own" ? (
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <input className="input font-mono flex-1" type="password" autoComplete="off" placeholder="Paste a TypeSafe API key" value={value} onChange={(e) => setValue(e.target.value)} style={{ minHeight: 42, minWidth: 260 }} />
          <button className="btn-primary" type="submit" disabled={busy || value.trim().length < 16}>{busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <KeyRound size={15} aria-hidden="true" />} Save key</button>
          <p className="m-0 basis-full text-[12.5px] text-muted">Keys come from <a href="https://typesafe.ai" target="_blank" rel="noreferrer" className="underline">typesafe.ai</a>. Jev bills your account about $0.042 per million tokens; a daily run on a big mailbox is a fraction of a cent. Stored encrypted, never shown again.</p>
        </form>
      ) : null}
      {msg ? <p className="m-0 text-[13px] text-muted">{msg}</p> : null}
    </section>
  );
}
