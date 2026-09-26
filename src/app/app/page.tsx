import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { AlertCircle, ArrowRight, Inbox, ListChecks, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { RunControls } from "@/components/RunControls";
import { ScheduleToggle } from "@/components/ScheduleToggle";
import { UndoButton } from "@/components/UndoButton";
import { DisconnectButton } from "@/components/DisconnectButton";
import { SignInButton } from "@/components/SignInButton";
import { SearchBox } from "@/components/app/SearchBox";
import { LabelBars, TabStack, VolumeBars } from "@/components/app/Charts";
import { RefreshStats } from "@/components/app/RefreshStats";
import { latestSnapshot } from "@/lib/engine/stats";
import { senderOverview } from "@/lib/engine/senders";
import { USD_PER_INPUT_TOKEN } from "@/lib/ai/triage";
import { daysAgo, num, pct, usd, when } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;
  const [mailbox] = await db.select().from(schema.mailboxes).where(eq(schema.mailboxes.userId, userId)).limit(1);
  if (!mailbox) redirect("/");

  const [runs, agg, stats, senders] = await Promise.all([
    db.select().from(schema.runs).where(eq(schema.runs.userId, userId)).orderBy(desc(schema.runs.startedAt)).limit(10),
    db.select({ tokens: sql<number>`coalesce(sum(${schema.aiJudgments.inputTokens}), 0)`, judged: sql<number>`count(*)` }).from(schema.aiJudgments).where(eq(schema.aiJudgments.userId, userId)).then((r) => r[0]),
    latestSnapshot(userId),
    senderOverview(userId, mailbox.policy),
  ]);
  const since = daysAgo(14);
  const recent = await db.select().from(schema.aiJudgments).where(and(eq(schema.aiJudgments.userId, userId), gte(schema.aiJudgments.createdAt, since))).orderBy(desc(schema.aiJudgments.receivedAt)).limit(300);
  const attention = recent.filter((j) => j.actions.some((a) => a.endsWith("flag:action"))).slice(0, 8);
  const trashCandidates = senders.filter((s) => s.recommendation.rec.startsWith("trash") && !s.decision);
  const reclaimable = trashCandidates.reduce((n, s) => n + s.messages, 0);
  const firstTime = runs.length === 0;

  return (
    <div className="section space-y-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-3 text-[clamp(30px,4vw,48px)] font-bold leading-tight tracking-[-0.02em]">{mailbox.email}</h1>
          <p className="text-sm text-muted">Last run {when(mailbox.lastRunAt)} · {mailbox.status === "active" ? "connected" : mailbox.status}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ScheduleToggle enabled={mailbox.scheduleEnabled} />
          <Link href="/app/policy" className="btn"><ListChecks size={15} /> Policy</Link>
        </div>
      </div>

      {mailbox.status === "needs_reauth" ? (
        <div className="card flex flex-wrap items-center justify-between gap-3" style={{ borderColor: "var(--warn)", background: "var(--warn-soft)" }}>
          <p className="flex items-center gap-2 text-sm"><AlertCircle size={16} /> Gmail access expired or was revoked. Reconnect to keep the schedule running.</p>
          <SignInButton label="Reconnect Gmail" />
        </div>
      ) : null}

      <SearchBox />

      {firstTime ? (
        <div className="card card--surface space-y-2">
          <h2 className="display text-2xl">First run: preview, then apply.</h2>
          <p className="text-[15px] text-muted">Preview changes nothing. Apply does the work and writes an undoable receipt.</p>
        </div>
      ) : null}

      <RunControls disabled={mailbox.status === "needs_reauth"} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><Inbox size={16} /> Mailbox map</h2><RefreshStats label={stats ? "Refresh" : "Count my mailbox"} /></div>
          {stats ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-surface p-2"><div className="display text-2xl">{num(stats.inbox.threads)}</div><div className="text-[11px] text-muted">inbox threads</div></div>
                  <div className="rounded-md bg-surface p-2"><div className="display text-2xl">{num(stats.inbox.unread)}</div><div className="text-[11px] text-muted">unread</div></div>
                  <div className="rounded-md bg-surface p-2"><div className="display text-2xl">{num(stats.system.TRASH?.threads ?? 0)}</div><div className="text-[11px] text-muted">in trash</div></div>
                </div>
                <div><p className="eyebrow mb-1">Inbox tabs</p><TabStack tabs={stats.tabs} /></div>
                <div><p className="eyebrow mb-1">Received, last 14 days</p><VolumeBars daily={stats.daily} /></div>
              </div>
              <div><p className="eyebrow mb-2">Largest labels · unread</p><LabelBars labels={stats.labels} /></div>
            </div>
          ) : <p className="text-sm text-muted">No numbers yet. Counting takes about ten seconds and runs automatically after every daily run.</p>}
          {stats ? <p className="text-[11.5px] text-muted">Counted {when(stats.takenAt)} · {num(stats.profile.messagesTotal)} messages in the account</p> : null}
        </div>
        <div className="space-y-4">
          <Link href="/app/trash" className="card block no-underline transition hover:border-accent">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><Trash2 size={16} /> What to trash</h2><ArrowRight size={16} className="text-muted" /></div>
            {senders.length ? (<><p className="display mt-2 text-4xl">{num(reclaimable)}</p><p className="text-sm text-muted">messages from {trashCandidates.length} senders Jev calls disposable and you rarely open. Review and apply in one click.</p></>) : <p className="mt-2 text-sm text-muted">Scan your senders to find out what is safe to throw away.</p>}
          </Link>
          <Link href="/app/senders" className="card block no-underline transition hover:border-accent">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><Users size={16} /> Senders</h2><ArrowRight size={16} className="text-muted" /></div>
            <p className="mt-2 text-sm text-muted">{senders.length ? `${senders.length} senders in the last 90 days, ${senders.filter((s) => s.decision).length} with standing decisions.` : "Volume, read rate, and a standing decision for every sender."}</p>
          </Link>
          <div className="card">
            <h2 className="flex items-center gap-2 font-bold"><ShieldCheck size={16} /> AI spend</h2>
            <p className="display mt-2 text-4xl">{usd(Number(agg?.tokens ?? 0) * USD_PER_INPUT_TOKEN)}</p>
            <p className="text-sm text-muted">{num(Number(agg?.judged ?? 0))} emails judged, each once. Rules are free.</p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="display text-2xl">Needs your attention</h2><Link href="/app/search?q=mail%20from%20real%20people%20that%20still%20needs%20my%20reply" className="btn btn-sm"><Search size={13} /> Find more</Link></div>
        {attention.length ? (
          <ul className="card divide-y divide-line p-0">
            {attention.map((j) => (
              <li key={j.messageId} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 text-sm">
                <div className="min-w-0"><p className="truncate font-semibold">{j.subject ?? "(no subject)"}</p><p className="truncate text-xs text-muted">{j.from}</p></div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="chip">{j.judgment.category}</span>
                  <span className="chip chip--accent">action {pct(j.judgment.needsAction)}</span>
                  {j.judgment.timeSensitive >= 0.6 ? <span className="chip chip--warn">time-sensitive</span> : null}
                  <a className="underline" href={`https://mail.google.com/mail/u/0/#all/${j.threadId ?? j.messageId}`} target="_blank" rel="noreferrer">open</a>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="card text-sm text-muted">Nothing flagged in the last two weeks. Flags come from the triage step of each run.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="display text-2xl">Runs</h2>
        {runs.length ? (
          <div className="card overflow-x-auto p-0">
            <table className="table">
              <thead><tr><th>Started</th><th>Mode</th><th>Trigger</th><th>Status</th><th className="text-right">Changed</th><th className="text-right">AI cost</th><th></th></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td><Link className="underline" href={`/app/runs/${r.id}`}>{when(r.startedAt)}</Link></td>
                    <td>{r.mode}</td><td>{r.trigger}</td>
                    <td>{r.status}{r.error ? <span className="block max-w-xs truncate text-xs text-danger" title={r.error}>{r.error}</span> : null}</td>
                    <td className="text-right">{num(r.summary?.totalApplied ?? 0)}</td>
                    <td className="text-right">{usd(r.summary?.ai?.estimatedCostUsd ?? 0)}</td>
                    <td className="text-right">{r.mode === "apply" && r.status === "ok" && (r.summary?.totalApplied ?? 0) > 0 ? <UndoButton runId={r.id} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="card text-sm text-muted">No runs yet. Start with a preview.</p>}
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold">Leave Mailroom</h2><p className="text-sm text-muted">Revokes the Google token and deletes your account, runs, senders, and judgments. Labels already in Gmail stay.</p></div>
        <DisconnectButton />
      </section>
    </div>
  );
}
