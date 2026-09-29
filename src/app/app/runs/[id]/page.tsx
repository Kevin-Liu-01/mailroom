import Link from "next/link";
import { ArrowLeft, CheckCircle2, Eye, Flag, ListChecks, Play, Tags, Zap } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { SummaryView } from "@/components/RunControls";
import { UndoButton } from "@/components/UndoButton";
import { num, when } from "@/lib/format";
import { CardTitle, Meta, PageHead } from "@/components/app/Bits";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { id } = await params;
  const [run] = await db.select().from(schema.runs).where(and(eq(schema.runs.id, id), eq(schema.runs.userId, session.user.id))).limit(1);
  if (!run) notFound();
  const batches = await db.select().from(schema.runBatches).where(eq(schema.runBatches.runId, id));
  return (
    <div className="section space-y-8">
      <PageHead icon={run.mode === "apply" ? <Play size={26} /> : <Eye size={26} />} title={`${run.mode === "apply" ? "Run" : "Preview"} on ${when(run.startedAt)}`} actions={<Link href="/app" className="btn"><ArrowLeft size={15} aria-hidden="true" /> Overview</Link>}>
        <Meta icon={Zap}>{run.trigger}</Meta>
        <Meta icon={CheckCircle2}>{run.status}</Meta>
        {run.finishedAt ? <Meta icon={Flag}>finished {when(run.finishedAt)}</Meta> : null}
      </PageHead>
      {run.error ? <p className="m-0 rounded-md border border-ink p-3 text-sm">{run.error}</p> : null}
      {run.summary ? <div className="card"><SummaryView summary={run.summary} /></div> : null}
      <div className="card space-y-3">
        <CardTitle icon={Tags} action={run.mode === "apply" && run.status === "ok" && batches.length ? <UndoButton runId={run.id} /> : null}>Label changes sent to Gmail</CardTitle>
        {batches.length ? (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted"><tr><th className="py-1 pr-3">Rule</th><th className="py-1 pr-3 text-right">Messages</th><th className="py-1 pr-3">Added</th><th className="py-1">Removed</th></tr></thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t border-line">
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
          <CardTitle icon={ListChecks}>Every search this run made</CardTitle>
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
