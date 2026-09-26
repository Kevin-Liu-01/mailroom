"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, ListChecks, Loader2, Play } from "lucide-react";
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
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="tile" aria-hidden="true"><ListChecks size={20} strokeWidth={2.2} /></span>
          <div>
            <h2 className="m-0 text-[15px] font-bold tracking-normal">Run the policy</h2>
            <p className="m-0 mt-0.5 text-[13.5px] text-muted">Preview changes nothing. Apply writes an undoable receipt.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn" disabled={disabled || busy !== null} onClick={() => run("dry-run")}>
            {busy === "dry-run" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
            {busy === "dry-run" ? "Previewing…" : "Preview"}
          </button>
          <button className="btn-primary" disabled={disabled || busy !== null} onClick={() => run("apply")}>
            {busy === "apply" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
            {busy === "apply" ? "Applying…" : "Apply now"}
          </button>
        </div>
      </div>
      {busy ? <p className="m-0 text-sm text-muted">Talking to Gmail{busy === "apply" ? " and TypeSafe" : ""}. Large mailboxes take a minute or two.</p> : null}
      {result && "error" in result ? (
        <p className="m-0 rounded-md border border-ink p-3 text-sm">
          {result.needsReauth ? "Gmail access expired or was revoked. Reconnect from the banner above." : result.error}
        </p>
      ) : null}
      {result && "summary" in result ? <SummaryView summary={result.summary} mode={busy ?? undefined} /> : null}
    </section>
  );
}

function Figure({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-2 rounded-md border border-line bg-surface px-3 py-1.5">
      <span className="text-[12px] font-bold text-muted">{name}</span>
      <strong className="text-[14px]">{children}</strong>
    </span>
  );
}

export function SummaryView({ summary }: { summary: RunSummary; mode?: string }) {
  const touched = summary.rules.filter((r) => r.matched > 0 || r.error || r.skipped);
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-2">
        <Figure name="changed">{num(summary.totalApplied)}</Figure>
        {summary.ai ? (
          <>
            <Figure name="AI judged">{num(summary.ai.messagesJudged)} of {num(summary.ai.messagesConsidered)}</Figure>
            <Figure name="AI cost">{usd(summary.ai.estimatedCostUsd)} · {num(summary.ai.inputTokens)} tokens</Figure>
            <Figure name="labeled / archived / flagged">{summary.ai.labeled} / {summary.ai.archived} / {summary.ai.flaggedAction}</Figure>
          </>
        ) : null}
        <Figure name="took">{(summary.durationMs / 1000).toFixed(1)}s</Figure>
      </div>
      {touched.length ? (
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>rule</th><th>kind</th><th className="text-right">matched</th><th className="text-right">applied</th><th>note</th></tr></thead>
            <tbody>
              {touched.map((r) => (
                <tr key={r.id}>
                  <td className="mono text-xs">{r.id}</td>
                  <td className="text-xs">{r.kind}</td>
                  <td className="text-right">{num(r.matched)}</td>
                  <td className="text-right">{num(r.applied)}</td>
                  <td className="text-xs text-muted">{r.error ?? r.skipped ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="m-0 text-muted">Nothing matched. The mailbox is already in policy.</p>}
    </div>
  );
}
