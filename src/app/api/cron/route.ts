import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { gmailFor, runMailbox } from "@/lib/engine/run";
import { snapshotMailbox } from "@/lib/engine/stats";
import { scanSenders } from "@/lib/engine/senders";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const due = await db.select({ userId: schema.mailboxes.userId, email: schema.mailboxes.email }).from(schema.mailboxes)
    .where(and(eq(schema.mailboxes.scheduleEnabled, true), eq(schema.mailboxes.status, "active")));
  const started = Date.now();
  const report: { userId: string; ok: boolean; applied?: number; error?: string }[] = [];
  for (const mb of due) {
    // Leave headroom inside the function's time budget; the next cron picks up the rest.
    if (Date.now() - started > 240_000) { report.push({ userId: mb.userId, ok: false, error: "deferred: out of time" }); continue; }
    try {
      const r = await runMailbox({ userId: mb.userId, mode: "apply", trigger: "cron" });
      try {
        const { gmail } = await gmailFor(mb.userId);
        await snapshotMailbox(gmail, mb.userId);
        // Refresh sender intelligence weekly so the "what to trash" view stays current without a click.
        const [last] = await db.select({ at: schema.senderProfiles.scannedAt }).from(schema.senderProfiles).where(eq(schema.senderProfiles.userId, mb.userId)).orderBy(desc(schema.senderProfiles.scannedAt)).limit(1);
        if (!last || Date.now() - last.at.getTime() > 7 * 86400_000) await scanSenders({ gmail, userId: mb.userId, days: 90, maxMessages: 1200, budgetUsd: 0.25 });
      } catch { /* stats and sender scans are best effort */ }
      report.push({ userId: mb.userId, ok: true, applied: r.summary.totalApplied });
    } catch (err) {
      report.push({ userId: mb.userId, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return NextResponse.json({ mailboxes: due.length, report, durationMs: Date.now() - started });
}
