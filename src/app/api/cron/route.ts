import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { runMailbox } from "@/lib/engine/run";

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
      report.push({ userId: mb.userId, ok: true, applied: r.summary.totalApplied });
    } catch (err) {
      report.push({ userId: mb.userId, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return NextResponse.json({ mailboxes: due.length, report, durationMs: Date.now() - started });
}
