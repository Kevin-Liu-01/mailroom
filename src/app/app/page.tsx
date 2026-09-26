import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { AlertTriangle, ArrowRight, ArrowUpRight, CalendarClock, CheckCircle2, Clock, Coins, Eye, Flag, History, Inbox, LogOut, MailOpen, Play, PlugZap, Search, SlidersHorizontal, Sparkles, Trash2, Users, XCircle } from "lucide-react";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { GmailMark } from "@/components/GmailMark";
import { RunControls } from "@/components/RunControls";
import { ScheduleToggle } from "@/components/ScheduleToggle";
import { UndoButton } from "@/components/UndoButton";
import { DisconnectButton } from "@/components/DisconnectButton";
import { SignInButton } from "@/components/SignInButton";
import { SearchBox } from "@/components/app/SearchBox";
import { LabelBars, TabStack, VolumeBars } from "@/components/app/Charts";
import { RefreshStats } from "@/components/app/RefreshStats";
import { CardTitle, Empty, Meta, PageHead, Stat } from "@/components/app/Bits";
import { latestSnapshot } from "@/lib/engine/stats";
import { senderOverview } from "@/lib/engine/senders";
import { USD_PER_INPUT_TOKEN } from "@/lib/ai/triage";
import { daysAgo, num, pct, usd, when } from "@/lib/format";

export const dynamic = "force-dynamic";

const label = "mb-2 text-[12.5px] font-bold text-muted";

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
  const decided = senders.filter((s) => s.decision).length;
  const firstTime = runs.length === 0;
  const needsReauth = mailbox.status === "needs_reauth";
  const spend = usd(Number(agg?.tokens ?? 0) * USD_PER_INPUT_TOKEN);
  const judged = num(Number(agg?.judged ?? 0));

  return (
    <div className="section space-y-10">
      <PageHead
        icon={<GmailMark size={30} />}
        title={mailbox.email}
        actions={<><Link href="/app/policy" className="btn"><SlidersHorizontal size={15} aria-hidden="true" /> Policy</Link><Link href="/app/search" className="btn"><Search size={15} aria-hidden="true" /> Search</Link></>}
      >
        <Meta icon={PlugZap}>{needsReauth ? "needs reconnect" : mailbox.status === "active" ? "connected" : mailbox.status}</Meta>
        <Meta icon={Clock}>last run {when(mailbox.lastRunAt)}</Meta>
        <Meta icon={CalendarClock}><ScheduleToggle enabled={mailbox.scheduleEnabled} /></Meta>
      </PageHead>

      {needsReauth ? (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-ink">
          <p className="m-0 flex items-center gap-2 text-sm"><AlertTriangle size={16} aria-hidden="true" /> Gmail access expired or was revoked. Reconnect to keep the schedule running.</p>
          <SignInButton label="Reconnect Gmail" />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Inbox} value={stats ? num(stats.inbox.threads) : "—"} label="inbox threads" />
        <Stat icon={MailOpen} value={stats ? num(stats.inbox.unread) : "—"} label="unread in inbox" />
        <Stat icon={Trash2} value={stats ? num(stats.system.TRASH?.threads ?? 0) : "—"} label="in trash" hint="30-day recovery" />
        <Stat icon={Coins} value={spend} label="spent on judgments" hint={`${judged} judged, each once`} />
      </div>

      <section className="card space-y-4">
        <CardTitle icon={Sparkles}>Ask your mailbox</CardTitle>
        <SearchBox />
      </section>

      {firstTime ? <Empty icon={Eye}><strong className="text-ink">Preview</strong> changes nothing. <strong className="text-ink">Apply</strong> does the work and writes an undoable receipt.</Empty> : null}

      <RunControls disabled={needsReauth} />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card space-y-5 lg:col-span-2">
          <CardTitle icon={Inbox} action={<RefreshStats label={stats ? "Refresh" : "Count my mailbox"} />}>Mailbox map</CardTitle>
          {stats ? (
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-5">
                <div><p className={label}>Inbox tabs</p><TabStack tabs={stats.tabs} /></div>
                <div><p className={label}>Received, last 14 days</p><VolumeBars daily={stats.daily} /></div>
              </div>
              <div><p className={label}>Largest labels · unread</p><LabelBars labels={stats.labels} /></div>
            </div>
          ) : <p className="m-0 text-sm text-muted">No numbers yet. Counting takes about ten seconds and runs automatically after every daily run.</p>}
          {stats ? <p className="m-0 text-[12px] text-muted">Counted {when(stats.takenAt)} · {num(stats.profile.messagesTotal)} messages in the account</p> : null}
        </section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Link href="/app/trash" className="card block space-y-3 no-underline transition hover:border-ink">
            <CardTitle icon={Trash2} action={<ArrowRight size={16} className="text-muted" aria-hidden="true" />}>What to trash</CardTitle>
            {senders.length ? (
              <>
                <p className="display m-0 text-[34px] leading-none">{num(reclaimable)}</p>
                <p className="m-0 text-[13.5px] text-muted">messages from {trashCandidates.length} senders Jev calls disposable and you rarely open.</p>
              </>
            ) : <p className="m-0 text-[13.5px] text-muted">Scan your senders to find out what is safe to throw away.</p>}
          </Link>
          <Link href="/app/senders" className="card block space-y-3 no-underline transition hover:border-ink">
            <CardTitle icon={Users} action={<ArrowRight size={16} className="text-muted" aria-hidden="true" />}>Senders</CardTitle>
            {senders.length ? (
              <>
                <p className="display m-0 text-[34px] leading-none">{num(senders.length)}</p>
                <p className="m-0 text-[13.5px] text-muted">senders in the last 90 days, {decided} with standing decisions.</p>
              </>
            ) : <p className="m-0 text-[13.5px] text-muted">Volume, read rate, and a standing decision for every sender.</p>}
          </Link>
        </div>
      </div>

      <section className="space-y-4">
        <CardTitle icon={Flag} action={<Link href="/app/search?q=mail%20from%20real%20people%20that%20still%20needs%20my%20reply" className="btn btn-sm"><Search size={13} aria-hidden="true" /> Find more</Link>}>Needs your attention</CardTitle>
        {attention.length ? (
          <ul className="card m-0 list-none divide-y divide-line p-0">
            {attention.map((j) => (
              <li key={j.messageId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="tile tile--sm" aria-hidden="true"><Flag size={14} /></span>
                  <div className="min-w-0"><p className="m-0 truncate font-bold">{j.subject ?? "(no subject)"}</p><p className="m-0 truncate text-xs text-muted">{j.from}</p></div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="chip">{j.judgment.category}</span>
                  <span className="chip chip--accent">action {pct(j.judgment.needsAction)}</span>
                  {j.judgment.timeSensitive >= 0.6 ? <span className="chip chip--warn">time-sensitive</span> : null}
                  <a className="btn btn-sm" href={`https://mail.google.com/mail/u/0/#all/${j.threadId ?? j.messageId}`} target="_blank" rel="noreferrer">Open <ArrowUpRight size={13} aria-hidden="true" /></a>
                </div>
              </li>
            ))}
          </ul>
        ) : <Empty icon={Flag}>Nothing flagged in the last two weeks. Flags come from the triage step of each run.</Empty>}
      </section>

      <section className="space-y-4">
        <CardTitle icon={History}>Runs</CardTitle>
        {runs.length ? (
          <div className="card overflow-x-auto p-0">
            <table className="table">
              <thead><tr><th>Started</th><th>Mode</th><th>Trigger</th><th>Status</th><th className="text-right">Changed</th><th className="text-right">AI cost</th><th></th></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td><Link className="underline" href={`/app/runs/${r.id}`}>{when(r.startedAt)}</Link></td>
                    <td><span className="inline-flex items-center gap-1.5">{r.mode === "apply" ? <Play size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}{r.mode === "apply" ? "apply" : "preview"}</span></td>
                    <td>{r.trigger}</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">{r.status === "ok" ? <CheckCircle2 size={13} aria-hidden="true" /> : r.status === "error" ? <XCircle size={13} aria-hidden="true" /> : <Clock size={13} aria-hidden="true" />}{r.status}</span>
                      {r.error ? <span className="block max-w-xs truncate text-xs text-muted" title={r.error}>{r.error}</span> : null}
                    </td>
                    <td className="text-right">{num(r.summary?.totalApplied ?? 0)}</td>
                    <td className="text-right">{usd(r.summary?.ai?.estimatedCostUsd ?? 0)}</td>
                    <td className="text-right">{r.mode === "apply" && r.status === "ok" && (r.summary?.totalApplied ?? 0) > 0 ? <UndoButton runId={r.id} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty icon={History}>No runs yet. Start with a preview.</Empty>}
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="tile tile--sm" aria-hidden="true"><LogOut size={16} /></span>
          <div>
            <h2 className="m-0 text-[15px] font-bold tracking-normal">Leave Mailroom</h2>
            <p className="m-0 mt-1 text-[13.5px] text-muted">Revokes the Google token and deletes your account, runs, senders, and judgments. Labels already in Gmail stay.</p>
          </div>
        </div>
        <DisconnectButton />
      </section>
    </div>
  );
}
