import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, gte } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { senderOverview } from "@/lib/engine/senders";
import { buildRules } from "@/lib/policy/rules";
import { ScanButton, SenderTable } from "@/components/app/SenderTable";
import { DisposableList } from "@/components/app/DisposableList";
import { daysAgo, num } from "@/lib/format";

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
    <div className="section space-y-8">
      <div>
        <Link href="/app" className="text-sm text-muted hover:text-ink">← Dashboard</Link>
        <p className="eyebrow mt-3">What to trash</p>
        <h1 className="text-3xl font-bold tracking-tight">Know what to throw away</h1>
        <p className="max-w-2xl text-muted">Three layers, from safest to most opinionated: the standing aging rules, Jev&apos;s per-sender judgment of what loses nothing after a month, and per-message disposability from triage. Everything lands in Gmail Trash with 30 days to change your mind, and every action is undoable.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card"><p className="eyebrow">Sender recommendations</p><p className="mt-1 text-3xl font-bold">{candidates.length}</p><p className="text-sm text-muted">senders, {num(reclaimable)} messages reclaimable</p></div>
        <div className="card"><p className="eyebrow">Disposable messages</p><p className="mt-1 text-3xl font-bold">{disposable.length}</p><p className="text-sm text-muted">judged ≥ 80% disposable in the last 60 days, not yet trashed</p></div>
        <div className="card"><p className="eyebrow">Standing trash rules</p><p className="mt-1 text-3xl font-bold">{trashRules.length}</p><p className="text-sm text-muted">run daily, capped at {num(mb.policy.aging.maxTrashPerRule)} per rule</p></div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-bold">By sender</h2><p className="text-sm text-muted">Jev reads volume, how often you open them, and sample subjects. Protect overrides everything else.</p></div>
          <ScanButton label={senders.length ? "Rescan senders" : "Scan senders"} />
        </div>
        <SenderTable rows={senders.map((s) => ({ ...s, lastSeenAt: s.lastSeenAt ? s.lastSeenAt.toISOString() : null, decision: s.decision ?? null }))} mode="trash" />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Disposable messages from triage</h2>
        <p className="text-sm text-muted">Messages the daily triage judged disposable once seen. Select and trash; or leave them and the aging rules will get the noisy categories later.</p>
        <DisposableList items={disposable.map((j) => ({ id: j.messageId, threadId: j.threadId, from: j.from, subject: j.subject, receivedAt: j.receivedAt?.toISOString() ?? null, category: j.judgment.category, disposable: j.judgment.disposable ?? 0 }))} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Standing rules</h2>
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
