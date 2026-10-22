import type { mailboxes } from "@/db/schema";
import { defaultPolicy } from "@/lib/policy/schema";

/**
 * A new mailbox's row. The daily apply run starts off: nothing in Gmail changes before its owner has previewed and
 * pressed Apply, as the landing page promises, and the dashboard's switch turns the schedule on (security audit
 * 2026-10, docs/security/2026-10-audit.md). Sign-in inserts this with on-conflict-do-nothing, so an existing mailbox
 * keeps its own setting.
 */
export function newMailbox(userId: string, email: string): typeof mailboxes.$inferInsert {
  return { userId, email, policy: defaultPolicy(), scheduleEnabled: false };
}
