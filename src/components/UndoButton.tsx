"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function UndoButton({ runId, disabled }: { runId: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function undo() {
    if (!confirm("Undo this run? Labels it added come off, archived mail returns to the inbox, trashed mail comes back. Read state is not restored.")) return;
    setBusy(true);
    const res = await fetch(`/api/runs/${runId}/undo`, { method: "POST" });
    const json = (await res.json()) as { messages?: number; error?: string };
    setMsg(json.error ? json.error : `Reversed ${json.messages ?? 0} message changes.`);
    setBusy(false);
    router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button className="btn py-1 text-xs" disabled={disabled || busy} onClick={undo}>{busy ? "Undoing…" : "Undo"}</button>
      {msg ? <span className="text-xs text-muted">{msg}</span> : null}
    </span>
  );
}
