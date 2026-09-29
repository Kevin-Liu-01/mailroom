import Link from "next/link";
import { History, ListChecks, Sparkles, Trash2, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { and, desc, eq, gte } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { senderOverview } from "@/lib/engine/senders";
import { buildRules } from "@/lib/policy/rules";
import { ScanButton, SenderTable } from "@/components/app/SenderTable";
import { DisposableList } from "@/components/app/DisposableList";
import { daysAgo, num } from "@/lib/format";
import { CardTitle, Meta, PageHead, Stat } from "@/components/app/Bits";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;
  const [mb] = await db.select().from(schema.mailboxes).where(eq(schema.mailboxes.userId, userId)).limit(1);
  if (!mb) redirect("/");
  const senders = await senderOverview(userId, mb.policy);
  const candidates = senders.filter((s) => s.recommendation.rec.startsWith("trash"));
  const reclaimable = candidates.reduce((n, s) => n + s.messages, 0);
  const since = daysAgo(60);
  const judged = await db.select().from(schema.aiJudgments).where(and(eq(schema.aiJudgments.userId, userId), gte(schema.aiJudgments.createdAt, since))).orderBy(desc(schema.aiJudgments.receivedAt)).limit(400);
  const disposable = judged.filter((j) => (j.judgment.disposable ?? 0) >= 0.8 && !j.actions.some((a) => a.includes("trash"))).slice(0, 60);
  const trashRules = buildRules(mb.policy).filter((r) => r.kind === "trash");
  const [lastRun] = await db.select().from(schema.runs).where(and(eq(schema.runs.userId, userId), eq(schema.runs.status, "ok"))).orderBy(desc(schema.runs.startedAt)).limit(1);
  const lastCounts = new Map((lastRun?.summary?.rules ?? []).map((r) => [r.id, r]));

  return (
    <div className="section space-y-10">
      <PageHead icon={<Trash2 size={26} />} title="Know what to throw away">
        <Meta icon={History}>Trash keeps 30 days, undo keeps more</Meta>
        <Meta icon={Users}>{num(senders.length)} senders scanned</Meta>
      </PageHead>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Users} value={num(candidates.length)} label="Senders Jev calls disposable" hint={`${num(reclaimable)} messages reclaimable`} />
        <Stat icon={Sparkles} value={num(disposable.length)} label="Disposable messages" hint="Judged ≥ 80% in the last 60 days, not yet trashed" />
        <Stat icon={ListChecks} value={num(trashRules.length)} label="Standing trash rules" hint={`Daily, capped at ${num(mb.policy.aging.maxTrashPerRule)} per rule`} />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle icon={Users}>By sender</CardTitle>
          <ScanButton label={senders.length ? "Rescan senders" : "Scan senders"} />
        </div>
        <SenderTable rows={senders.map((s) => ({ ...s, lastSeenAt: s.lastSeenAt ? s.lastSeenAt.toISOString() : null, decision: s.decision ?? null }))} mode="trash" />
      </section>

      <section className="space-y-3">
        <CardTitle icon={Sparkles}>Disposable messages from triage</CardTitle>
        <p className="m-0 text-sm text-muted">Judged disposable by triage. Select and trash, or let the aging rules catch them.</p>
        <DisposableList items={disposable.map((j) => ({ id: j.messageId, threadId: j.threadId, from: j.from, subject: j.subject, receivedAt: j.receivedAt?.toISOString() ?? null, category: j.judgment.category, disposable: j.judgment.disposable ?? 0 }))} />
      </section>

      <section className="space-y-3">
        <CardTitle icon={ListChecks}>Standing rules</CardTitle>
        <div className="card p-0">
          <table className="table">
            <thead><tr><th>Rule</th><th>Gmail search</th><th className="text-right">Last run matched</th></tr></thead>
            <tbody>
              {trashRules.map((r) => (
                <tr key={r.id}><td><div className="font-semibold">{r.id}</div><div className="text-[12px] text-muted">{r.why}</div></td><td className="mono text-[12px]">{r.query}</td><td className="text-right">{num(lastCounts.get(r.id)?.matched ?? 0)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted">Change the day counts, or turn a rule off, in <Link href="/app/policy" className="underline">the policy</Link>.</p>
      </section>
    </div>
  );
}
