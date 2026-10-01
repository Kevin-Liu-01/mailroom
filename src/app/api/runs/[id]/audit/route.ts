import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { gmailFor } from "@/lib/engine/run";
import { mapLimit } from "@/lib/gmail/client";
import { describeBatch, gradeAction } from "@/lib/ai/grade";
import { USD_PER_INPUT_TOKEN } from "@/lib/ai/triage";

export const maxDuration = 60;
const SYSTEM: Record<string, string> = { TRASH: "Trash", INBOX: "Inbox", UNREAD: "Unread", IMPORTANT: "Important", STARRED: "Starred" };

/** Grade a page of one batch's emails: did the rule do the right thing to each? Metadata only, Jev as the grader. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { batchId?: string; offset?: number; limit?: number };
  if (!body.batchId) return NextResponse.json({ error: "batchId required" }, { status: 400 });
  const offset = Math.max(0, Number(body.offset ?? 0) || 0);
  const limit = Math.min(Math.max(Number(body.limit ?? 40) || 40, 1), 40);
  const [run] = await db.select().from(schema.runs).where(and(eq(schema.runs.id, id), eq(schema.runs.userId, userId))).limit(1);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [batch] = await db.select().from(schema.runBatches).where(and(eq(schema.runBatches.id, body.batchId), eq(schema.runBatches.runId, id))).limit(1);
  if (!batch) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const { gmail, email } = await gmailFor(userId);
    const names = new Map<string, string>(Object.entries(SYSTEM));
    for (const l of await gmail.listLabels()) if (l.type === "user") names.set(l.id, l.name);
    const name = (l: string) => names.get(l) ?? l;
    const rule = describeBatch(batch.ruleId, run.summary?.rules.find((r) => r.id === batch.ruleId)?.query, batch.addLabelIds, batch.removeLabelIds, name);
    const ids = batch.messageIds.slice(offset, offset + limit);
    const metas = await mapLimit(ids, 8, (mid) => gmail.getMessageMeta(mid).catch(() => null));
    let inputTokens = 0, model: string | null = null;
    const rows = await mapLimit(ids, 6, async (mid, i) => {
      const m = metas[i];
      if (!m) return { id: mid, gone: true as const };
      const labels = m.labelIds.filter((l) => !l.startsWith("CATEGORY_") && !["UNREAD", "INBOX", "IMPORTANT", "STARRED", "SENT", "TRASH"].includes(l)).map(name);
      try {
        const g = await gradeAction(m, rule, email, labels);
        inputTokens += g.inputTokens; model = g.model;
        return { id: mid, from: m.headers["from"] ?? "", subject: m.headers["subject"] ?? "(no subject)", date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : null, inTrash: m.labelIds.includes("TRASH"), verdict: g.verdict, actionOk: g.actionOk, belongs: g.belongs, worthKeeping: g.worthKeeping, why: g.why };
      } catch (err) {
        return { id: mid, from: m.headers["from"] ?? "", subject: m.headers["subject"] ?? "(no subject)", date: null, inTrash: m.labelIds.includes("TRASH"), verdict: "unsure" as const, actionOk: 0.5, belongs: 0.5, worthKeeping: 0.5, why: `Not graded: ${err instanceof Error ? err.message : "error"}` };
      }
    });
    return NextResponse.json({ total: batch.messageIds.length, offset, rule, rows, cost: { inputTokens, usd: inputTokens * USD_PER_INPUT_TOKEN }, model });
  } catch (err) {
    console.error("[audit] failed", { runId: id, batchId: body.batchId, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
