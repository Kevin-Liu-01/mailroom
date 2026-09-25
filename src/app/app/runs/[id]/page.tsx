import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { SummaryView } from "@/components/RunControls";
import { UndoButton } from "@/components/UndoButton";
import { num, when } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { id } = await params;
  const [run] = await db.select().from(schema.runs).where(and(eq(schema.runs.id, id), eq(schema.runs.userId, session.user.id))).limit(1);
  if (!run) notFound();
  const batches = await db.select().from(schema.runBatches).where(eq(schema.runBatches.runId, id));
  return (
    <div className="section space-y-6">
      <div>
        <Link href="/app" className="text-sm text-muted hover:text-ink">← Dashboard</Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{run.mode === "apply" ? "Run" : "Preview"} on {when(run.startedAt)}</h1>
        <p className="text-sm text-muted">{run.trigger} · {run.status}{run.finishedAt ? ` · finished ${when(run.finishedAt)}` : ""}</p>
      </div>
      {run.error ? <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">{run.error}</p> : null}
      {run.summary ? <div className="card"><SummaryView summary={run.summary} /></div> : null}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Label changes sent to Gmail</h2>
          {run.mode === "apply" && run.status === "ok" && batches.length ? <UndoButton runId={run.id} /> : null}
        </div>
        {batches.length ? (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted"><tr><th className="py-1 pr-3">rule</th><th className="py-1 pr-3 text-right">messages</th><th className="py-1 pr-3">added</th><th className="py-1">removed</th></tr></thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="mono py-1.5 pr-3 text-xs">{b.ruleId}</td>
                  <td className="py-1.5 pr-3 text-right">{num(b.messageIds.length)}</td>
                  <td className="mono py-1.5 pr-3 text-xs">{b.addLabelIds.join(", ") || "-"}</td>
                  <td className="mono py-1.5 text-xs">{b.removeLabelIds.join(", ") || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-sm text-muted">{run.mode === "dry-run" ? "Previews send nothing to Gmail." : "No changes were needed."}</p>}
      </div>
      {run.summary?.rules.length ? (
        <div className="card space-y-2">
          <h2 className="font-medium">Every search this run made</h2>
          <ul className="space-y-1 text-xs">
            {run.summary.rules.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-2"><span className="mono">{r.id}</span><span className="text-muted">{r.query}</span><span>{num(r.matched)} matched</span></li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
