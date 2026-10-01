import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { gmailFor } from "@/lib/engine/run";

export const maxDuration = 60;

/** Undo one batch's change for just the given messages: the same reversal undoRun applies, narrowed to a few ids. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { batchId?: string; messageIds?: string[] };
  if (!body.batchId || !Array.isArray(body.messageIds) || !body.messageIds.length) return NextResponse.json({ error: "batchId and messageIds required" }, { status: 400 });
  const [run] = await db.select({ id: schema.runs.id }).from(schema.runs).where(and(eq(schema.runs.id, id), eq(schema.runs.userId, userId))).limit(1);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [batch] = await db.select().from(schema.runBatches).where(and(eq(schema.runBatches.id, body.batchId), eq(schema.runBatches.runId, id))).limit(1);
  if (!batch) return NextResponse.json({ error: "not found" }, { status: 404 });
  const allowed = new Set(batch.messageIds);
  const ids = [...new Set(body.messageIds)].filter((m) => allowed.has(m)).slice(0, 500);
  if (!ids.length) return NextResponse.json({ error: "none of those messages belong to this batch" }, { status: 400 });
  try {
    const { gmail } = await gmailFor(userId);
    await gmail.batchModify(ids, batch.restoreLabelIds, batch.addLabelIds);
    return NextResponse.json({ restored: ids.length, backInInbox: batch.restoreLabelIds.includes("INBOX") });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
