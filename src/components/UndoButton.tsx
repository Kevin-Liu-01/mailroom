"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { ConfirmButton } from "@/components/Confirm";

export function UndoButton({ runId, disabled }: { runId: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function undo() {
    setBusy(true);
    const res = await fetch(`/api/runs/${runId}/undo`, { method: "POST" });
    const json = (await res.json()) as { messages?: number; filters?: number; error?: string };
    setMsg(json.error ? json.error : [json.messages ? `Reversed ${json.messages} message changes` : null, json.filters ? `${json.filters} filter changes` : null].filter(Boolean).join(" and ") + "." || "Undone.");
    setBusy(false);
    router.refresh();
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <ConfirmButton
        className="btn btn-sm"
        armedClassName="btn-primary btn-sm"
        icon={<Undo2 size={13} aria-hidden="true" />}
        label="Undo"
        confirmLabel="Undo this run"
        message="Labels it added come off, archived mail returns, trashed mail comes back."
        onConfirm={undo}
        disabled={disabled}
        busy={busy}
        busyLabel="Undoing…"
      />
      {msg ? <span className="text-xs text-muted">{msg}</span> : null}
    </span>
  );
}
