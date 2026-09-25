"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RunSummary } from "@/db/schema";
import { usd, num } from "@/lib/format";

type Result = { runId: string; summary: RunSummary } | { error: string; needsReauth?: boolean };

export function RunControls({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"dry-run" | "apply" | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function run(mode: "dry-run" | "apply") {
    if (mode === "apply" && !confirm("Apply the policy to your mailbox now? Every change is recorded and can be undone from the run list.")) return;
    setBusy(mode);
    setResult(null);
    try {
      const res = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
      setResult((await res.json()) as Result);
      router.refresh();
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Run the policy</h2>
          <p className="text-sm text-muted">Preview changes nothing. Apply writes an undoable receipt.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn" disabled={disabled || busy !== null} onClick={() => run("dry-run")}>{busy === "dry-run" ? "Previewing…" : "Preview"}</button>
          <button className="btn-primary" disabled={disabled || busy !== null} onClick={() => run("apply")}>{busy === "apply" ? "Applying…" : "Apply now"}</button>
        </div>
      </div>
      {busy ? <p className="text-sm text-muted">Talking to Gmail{busy === "apply" ? " and TypeSafe" : ""}. Large mailboxes take a minute or two.</p> : null}
      {result && "error" in result ? (
        <p className="rounded-md p-3 text-sm" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
          {result.needsReauth ? "Gmail access expired or was revoked. Reconnect from the banner above." : result.error}
        </p>
      ) : null}
      {result && "summary" in result ? <SummaryView summary={result.summary} mode={busy ?? undefined} /> : null}
    </div>
  );
}

export function SummaryView({ summary }: { summary: RunSummary; mode?: string }) {
  const touched = summary.rules.filter((r) => r.matched > 0 || r.error || r.skipped);
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-4">
        <span><span className="eyebrow">changed</span> <strong>{num(summary.totalApplied)}</strong></span>
        {summary.ai ? (
          <>
            <span><span className="eyebrow">AI judged</span> <strong>{num(summary.ai.messagesJudged)}</strong> of {num(summary.ai.messagesConsidered)}</span>
            <span><span className="eyebrow">AI cost</span> <strong>{usd(summary.ai.estimatedCostUsd)}</strong> ({num(summary.ai.inputTokens)} tokens)</span>
            <span><span className="eyebrow">labeled / archived / flagged</span> <strong>{summary.ai.labeled} / {summary.ai.archived} / {summary.ai.flaggedAction}</strong></span>
          </>
        ) : null}
        <span><span className="eyebrow">took</span> <strong>{(summary.durationMs / 1000).toFixed(1)}s</strong></span>
      </div>
      {touched.length ? (
        <table className="w-full text-left">
          <thead className="text-xs text-muted"><tr><th className="py-1 pr-3">rule</th><th className="py-1 pr-3">kind</th><th className="py-1 pr-3 text-right">matched</th><th className="py-1 pr-3 text-right">applied</th><th className="py-1">note</th></tr></thead>
          <tbody>
            {touched.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="mono py-1.5 pr-3 text-xs">{r.id}</td>
                <td className="py-1.5 pr-3 text-xs">{r.kind}</td>
                <td className="py-1.5 pr-3 text-right">{num(r.matched)}</td>
                <td className="py-1.5 pr-3 text-right">{num(r.applied)}</td>
                <td className="py-1.5 text-xs text-muted">{r.error ?? r.skipped ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="text-muted">Nothing matched. The mailbox is already in policy.</p>}
    </div>
  );
}
