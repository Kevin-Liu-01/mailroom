/** Manual actions from search and trash pages: applied through batchModify and recorded as an undoable run. */
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { gmailFor } from "./run";

export type ManualAction = "archive" | "trash" | "read" | "unread" | "star" | "unstar" | "inbox" | "label";

export async function applyManual(userId: string, ids: string[], action: ManualAction, labelName?: string): Promise<{ runId: string; messages: number }> {
  if (!ids.length) throw new Error("No messages selected");
  const unique = [...new Set(ids)].slice(0, 5000);
  const { gmail } = await gmailFor(userId);
  let add: string[] = [], remove: string[] = [], restore: string[] = [];
  switch (action) {
    case "archive": remove = ["INBOX"]; restore = ["INBOX"]; break;
    case "trash": add = ["TRASH"]; remove = ["INBOX", "UNREAD"]; restore = ["INBOX"]; break;
    case "read": remove = ["UNREAD"]; break;
    case "unread": add = ["UNREAD"]; break;
    case "star": add = ["STARRED"]; break;
    case "unstar": remove = ["STARRED"]; break;
    case "inbox": add = ["INBOX"]; remove = ["TRASH"]; break;
    case "label": {
      if (!labelName) throw new Error("label name required");
      const labels = await gmail.ensureLabels([labelName]);
      add = [labels[labelName]];
      break;
    }
  }
  const [run] = await db.insert(schema.runs).values({ userId, mode: "apply", trigger: "manual" }).returning({ id: schema.runs.id });
  try {
    await gmail.batchModify(unique, add, remove);
    await db.insert(schema.runBatches).values({ runId: run.id, ruleId: `manual:${action}${labelName ? `:${labelName}` : ""}`, messageIds: unique, addLabelIds: add, removeLabelIds: remove, restoreLabelIds: restore });
    await db.update(schema.runs).set({ status: "ok", finishedAt: new Date(), summary: { rules: [{ id: `manual:${action}`, kind: action === "trash" ? "trash" : action === "archive" ? "archive" : "label", matched: unique.length, applied: unique.length }], totalApplied: unique.length, durationMs: 0 } }).where(eq(schema.runs.id, run.id));
    return { runId: run.id, messages: unique.length };
  } catch (err) {
    await db.update(schema.runs).set({ status: "error", error: err instanceof Error ? err.message : String(err), finishedAt: new Date() }).where(eq(schema.runs.id, run.id));
    throw err;
  }
}
