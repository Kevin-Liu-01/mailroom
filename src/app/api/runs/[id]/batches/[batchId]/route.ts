import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { gmailFor } from "@/lib/engine/run";
import { mapLimit } from "@/lib/gmail/client";

export const maxDuration = 60;

const HIDDEN = new Set(["UNREAD", "INBOX", "IMPORTANT", "STARRED", "SENT", "TRASH", "SPAM", "DRAFT"]);

/** The emails one batch touched: who sent them, the subject, and where each sits in Gmail now. Metadata only, a page at a time. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; batchId: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, batchId } = await params;
  const url = new URL(req.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 10) || 10, 1), 40);
  const [run] = await db.select({ id: schema.runs.id }).from(schema.runs).where(and(eq(schema.runs.id, id), eq(schema.runs.userId, userId))).limit(1);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [batch] = await db.select().from(schema.runBatches).where(and(eq(schema.runBatches.id, batchId), eq(schema.runBatches.runId, id))).limit(1);
  if (!batch) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const { gmail } = await gmailFor(userId);
    const names = new Map((await gmail.listLabels()).map((l) => [l.id, l.name]));
    const ids = batch.messageIds.slice(offset, offset + limit);
    const metas = await mapLimit(ids, 8, (mid) => gmail.getMessageMeta(mid, ["From", "Subject", "Date"]).catch(() => null));
    const rows = ids.map((mid, i) => {
      const m = metas[i];
      if (!m) return { id: mid, gone: true as const };
      return {
        id: mid,
        from: m.headers["from"] ?? "",
        subject: m.headers["subject"] ?? "(no subject)",
        date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : null,
        inTrash: m.labelIds.includes("TRASH"),
        inInbox: m.labelIds.includes("INBOX"),
        unread: m.labelIds.includes("UNREAD"),
        labels: m.labelIds.filter((l) => !l.startsWith("CATEGORY_") && !HIDDEN.has(l)).map((l) => names.get(l) ?? l),
      };
    });
    return NextResponse.json({ total: batch.messageIds.length, offset, rows });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
