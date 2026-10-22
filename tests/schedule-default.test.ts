import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { mailboxes } from "@/db/schema";
import { newMailbox } from "@/lib/mailbox";

/**
 * The daily apply run is opt-in (security audit 2026-10, docs/security/2026-10-audit.md): a new mailbox starts with
 * the schedule off, so nothing in Gmail changes before its owner has previewed and pressed Apply, as the landing page
 * promises. The owner turns the daily run on with the dashboard's switch; mailboxes that already exist keep theirs.
 */
describe("a new mailbox's daily run", () => {
  it("starts off", () => {
    const row = newMailbox("user_1", "ada@example.com");
    expect(row).toMatchObject({ userId: "user_1", email: "ada@example.com", scheduleEnabled: false });
    expect(row.policy).toBeTruthy();
  });

  it("the column's own default is off too, for any row written without it", () => {
    expect(getTableColumns(mailboxes).scheduleEnabled.default).toBe(false);
  });
});
