import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { RunControls } from "@/components/RunControls";
import { ScheduleToggle } from "@/components/ScheduleToggle";
import { UndoButton } from "@/components/UndoButton";
import { DisconnectButton } from "@/components/DisconnectButton";
import { SignInButton } from "@/components/SignInButton";
import { USD_PER_INPUT_TOKEN } from "@/lib/ai/triage";
import { num, pct, usd, when } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;
  const [mailbox] = await db.select().from(schema.mailboxes).where(eq(schema.mailboxes.userId, userId)).limit(1);
  if (!mailbox) redirect("/");

  const runs = await db.select().from(schema.runs).where(eq(schema.runs.userId, userId)).orderBy(desc(schema.runs.startedAt)).limit(12);
  const [agg] = await db.select({ tokens: sql<number>`coalesce(sum(${schema.aiJudgments.inputTokens}), 0)`, judged: sql<number>`count(*)` }).from(schema.aiJudgments).where(eq(schema.aiJudgments.userId, userId));
  const since = new Date(Date.now() - 14 * 86400_000);
  const flagged = await db.select().from(schema.aiJudgments)
    .where(and(eq(schema.aiJudgments.userId, userId), gte(schema.aiJudgments.createdAt, since)))
    .orderBy(desc(schema.aiJudgments.receivedAt)).limit(200);
  const attention = flagged.filter((j) => j.actions.some((a) => a.endsWith("flag:action"))).slice(0, 12);
  const lifetimeApplied = runs.reduce((n, r) => n + (r.summary?.totalApplied ?? 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Mailbox</p>
          <h1 className="text-2xl font-semibold tracking-tight">{mailbox.email}</h1>
        </div>
        <div className="flex items-center gap-4">
          <ScheduleToggle enabled={mailbox.scheduleEnabled} />
          <Link href="/app/policy" className="btn">Edit policy</Link>
        </div>
      </div>

      {mailbox.status === "needs_reauth" ? (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-amber-500/40 bg-amber-500/10">
          <p className="text-sm">Gmail access expired or was revoked. Reconnect to keep the schedule running.</p>
          <SignInButton label="Reconnect Gmail" />
        </div>
      ) : null}

      <RunControls disabled={mailbox.status === "needs_reauth"} />

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card"><p className="label">Last run</p><p className="mt-1 text-lg font-semibold">{when(mailbox.lastRunAt)}</p></div>
        <div className="card"><p className="label">Changes, last 12 runs</p><p className="mt-1 text-lg font-semibold">{num(lifetimeApplied)}</p></div>
        <div className="card"><p className="label">Emails judged by AI</p><p className="mt-1 text-lg font-semibold">{num(Number(agg?.judged ?? 0))}</p></div>
        <div className="card"><p className="label">AI spend, lifetime</p><p className="mt-1 text-lg font-semibold">{usd(Number(agg?.tokens ?? 0) * USD_PER_INPUT_TOKEN)}</p></div>
      </div>

      <section className="space-y-3">
        <h2 className="font-medium">Needs your attention</h2>
        {attention.length ? (
          <ul className="card divide-y divide-border p-0">
            {attention.map((j) => (
              <li key={j.messageId} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{j.subject ?? "(no subject)"}</p>
                  <p className="truncate text-xs text-muted">{j.from}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span>{j.judgment.category}</span>
                  <span title="probability that you need to act">action {pct(j.judgment.needsAction)}</span>
                  {j.judgment.timeSensitive >= 0.6 ? <span className="rounded bg-accent-soft px-1.5 py-0.5">time-sensitive</span> : null}
                  <a className="underline" href={`https://mail.google.com/mail/u/0/#all/${j.threadId ?? j.messageId}`} target="_blank" rel="noreferrer">open</a>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">Nothing flagged in the last two weeks. Flags come from the AI triage step of each run.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Runs</h2>
        {runs.length ? (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted"><tr><th className="px-5 py-2">started</th><th className="px-2 py-2">mode</th><th className="px-2 py-2">trigger</th><th className="px-2 py-2">status</th><th className="px-2 py-2 text-right">changed</th><th className="px-2 py-2 text-right">AI cost</th><th className="px-5 py-2"></th></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-5 py-2"><Link className="underline" href={`/app/runs/${r.id}`}>{when(r.startedAt)}</Link></td>
                    <td className="px-2 py-2">{r.mode}</td>
                    <td className="px-2 py-2">{r.trigger}</td>
                    <td className="px-2 py-2">{r.status}{r.error ? <span className="block max-w-xs truncate text-xs text-red-500" title={r.error}>{r.error}</span> : null}</td>
                    <td className="px-2 py-2 text-right">{num(r.summary?.totalApplied ?? 0)}</td>
                    <td className="px-2 py-2 text-right">{usd(r.summary?.ai?.estimatedCostUsd ?? 0)}</td>
                    <td className="px-5 py-2 text-right">{r.mode === "apply" && r.status === "ok" && (r.summary?.totalApplied ?? 0) > 0 ? <UndoButton runId={r.id} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted">No runs yet. Start with a preview.</p>}
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">Leave Mailroom</h2>
          <p className="text-sm text-muted">Revokes the Google token and deletes your account, runs, and judgments. Labels already in Gmail stay.</p>
        </div>
        <DisconnectButton />
      </section>
    </div>
  );
}
