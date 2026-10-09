import Link from "next/link";
import { maskIf } from "@/lib/privacy";
import { emailsHidden } from "@/lib/privacy-server";
import { Masked } from "@/components/app/Privacy";
import { ArrowLeft, CheckCircle2, Eye, Filter, Flag, ListChecks, Play, Tags, Zap } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { SummaryView } from "@/components/RunControls";
import { UndoButton } from "@/components/UndoButton";
import { num, when } from "@/lib/format";
import { CardTitle, Meta, PageHead, TonedChip } from "@/components/app/Bits";
import { RunBatchMessages } from "@/components/app/RunBatchMessages";
import { RunBatchAudit } from "@/components/app/RunBatchAudit";
import { gmailFor } from "@/lib/engine/run";

const SYSTEM_LABELS: Record<string, string> = { TRASH: "Trash", INBOX: "Inbox", UNREAD: "Unread", IMPORTANT: "Important", STARRED: "Starred", SPAM: "Spam" };

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, hidden] = await Promise.all([auth(), emailsHidden()]);
  if (!session?.user?.id) redirect("/");
  const { id } = await params;
  const [run] = await db.select().from(schema.runs).where(and(eq(schema.runs.id, id), eq(schema.runs.userId, session.user.id))).limit(1);
  if (!run) notFound();
  const batches = await db.select().from(schema.runBatches).where(eq(schema.runBatches.runId, id));
  // Label ids read as names when Gmail is reachable; system ids have fixed names.
  const names = new Map<string, string>(Object.entries(SYSTEM_LABELS));
  const filterChanges = run.summary?.filters && (run.summary.filters.created.length || run.summary.filters.deleted.length) ? run.summary.filters : null;
  const undoable = run.mode === "apply" && run.status === "ok" && (batches.length > 0 || Boolean(filterChanges) || Boolean(run.summary?.policyBefore));
  if (batches.length || filterChanges) {
    try { for (const l of await (await gmailFor(session.user.id)).gmail.listLabels()) if (l.type === "user") names.set(l.id, l.name); } catch { /* fall back to ids */ }
  }
  const labelName = (l: string) => names.get(l) ?? l;
  return (
    <div className="section space-y-8">
      <PageHead icon={run.mode === "apply" ? <Play size={26} /> : <Eye size={26} />} title={`${run.mode === "apply" ? "Run" : "Preview"} on ${when(run.startedAt)}`} actions={<Link href="/app" className="btn"><ArrowLeft size={15} aria-hidden="true" /> Overview</Link>}>
        <Meta icon={Zap}>{run.trigger}</Meta>
        <Meta icon={CheckCircle2}>{run.status}</Meta>
        {run.finishedAt ? <Meta icon={Flag}>finished {when(run.finishedAt)}</Meta> : null}
      </PageHead>
      {run.error ? <p className="m-0 rounded-md border border-ink p-3 text-sm">{run.error}</p> : null}
      {run.summary ? <div className="card"><SummaryView summary={run.summary} /></div> : null}
      <div className="space-y-4">
        <CardTitle icon={Tags} action={undoable && batches.length ? <UndoButton runId={run.id} /> : null}>What changed, email by email</CardTitle>
        {batches.length ? batches.map((b) => (
          <section key={b.id} className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-2 text-[13.5px]">
                <span className="font-mono font-bold">{b.ruleId}</span>
                <span className="text-muted">{num(b.messageIds.length)} {b.messageIds.length === 1 ? "email" : "emails"}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {b.addLabelIds.map((l) => <TonedChip key={`+${l}`} tone={l === "TRASH" ? "amber" : "green"}>+ {labelName(l)}</TonedChip>)}
                {b.removeLabelIds.map((l) => <TonedChip key={`-${l}`} tone="ink">− {labelName(l)}</TonedChip>)}
              </div>
            </div>
            <RunBatchMessages runId={run.id} batchId={b.id} total={b.messageIds.length} />
            {run.mode === "apply" ? <RunBatchAudit runId={run.id} batchId={b.id} total={b.messageIds.length} kind={b.addLabelIds.includes("TRASH") ? "trash" : b.removeLabelIds.includes("INBOX") && !b.addLabelIds.length ? "archive" : "label"} /> : null}
          </section>
        )) : <p className="card m-0 text-sm text-muted">{run.mode === "dry-run" ? "Previews send nothing to Gmail." : filterChanges ? "No email was relabeled. This run changed Gmail filters only." : "No changes were needed."}</p>}
      </div>
      {run.summary?.filters && (run.summary.filters.created.length || run.summary.filters.deleted.length) ? (
        <div className="card space-y-3">
          <CardTitle icon={Filter} action={undoable && !batches.length ? <UndoButton runId={run.id} /> : null}>Gmail filters</CardTitle>
          <div className="grid gap-4 text-[13px] sm:grid-cols-2">
            {([["Created", run.summary.filters.created], ["Removed", run.summary.filters.deleted]] as const).map(([title, list]) => (
              <div key={title}>
                <p className="m-0 mb-1.5 text-muted">{title} · {list.length}</p>
                <ul className="m-0 list-none space-y-1.5 p-0">
                  {list.map((f) => {
                    const c = f.criteria as { from?: string; subject?: string };
                    const adds = (f.action.addLabelIds ?? []).map(labelName).filter((l) => !/^[A-Z_]+$/.test(l));
                    return (
                      <li key={f.id} className="min-w-0">
                        <span className="font-medium">{adds.join(" + ") || f.name || "Filter"}</span>
                        <span className="block truncate font-mono text-[11.5px] text-muted" title={maskIf(hidden, c.from ?? c.subject)}>{c.from ? <>from <Masked text={c.from} /></> : <>subject <Masked text={c.subject} /></>}</span>
                      </li>
                    );
                  })}
                  {list.length ? null : <li className="text-muted">none</li>}
                </ul>
              </div>
            ))}
          </div>
          {run.summary.policyBefore ? <p className="m-0 text-[12.5px] text-muted">This run also changed your routes. Undo restores the policy as it was.</p> : null}
        </div>
      ) : null}
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
