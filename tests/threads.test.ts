import { describe, expect, it } from "vitest";
import { groupThreads, isMe, summarizeThread } from "@/lib/search/threads";
import type { GmailMessageMeta, GmailThreadMessage } from "@/lib/gmail/client";

const me = "kevin@example.com";
const msg = (id: string, threadId: string, from: string, at: number, extra: Partial<GmailMessageMeta> = {}): GmailMessageMeta => ({ id, threadId, labelIds: [], snippet: "", internalDate: String(at), headers: { from, subject: "s" }, ...extra });
const tm = (id: string, from: string, at: number): GmailThreadMessage => ({ id, from, to: me, date: "", internalDate: String(at), labelIds: [] });

describe("threads", () => {
  it("recognises the user's own address in any From format", () => {
    expect(isMe("Kevin L <kevin@example.com>", me)).toBe(true);
    expect(isMe("KEVIN@example.com", me)).toBe(true);
    expect(isMe("Adam <adam@gym.com>", me)).toBe(false);
  });
  it("collapses messages into threads with the newest message in front", () => {
    const rows = groupThreads([msg("a", "t1", "Adam <adam@gym.com>", 100), msg("b", "t1", "Adam <adam@gym.com>", 300, { labelIds: ["UNREAD"] }), msg("c", "t2", "Eli <eli@pax.co>", 200)]);
    expect(rows.map((r) => r.threadId)).toEqual(["t1", "t2"]);
    expect(rows[0].latest.id).toBe("b");
    expect(rows[0].matched).toBe(2);
    expect(rows[0].unread).toBe(1);
    expect(rows[0].messageIds).toEqual(["b", "a"]);
  });
  it("reads who spoke last from the thread, not from the matched message", () => {
    const answered = summarizeThread([tm("1", "Adam <adam@gym.com>", 100), tm("2", `Kevin <${me}>`, 200)], me);
    expect(answered.lastFromMe).toBe(true);
    expect(answered.repliedAfterLatest).toBe(true);
    expect(answered.anyFromMe).toBe(true);
    const owed = summarizeThread([tm("1", `Kevin <${me}>`, 100), tm("2", "Adam <adam@gym.com>", 200)], me);
    expect(owed.lastFromMe).toBe(false);
    expect(owed.repliedAfterLatest).toBe(false);
    const never = summarizeThread([tm("1", "Recruiter <r@agency.com>", 100), tm("2", "Recruiter <r@agency.com>", 300)], me);
    expect(never.anyFromMe).toBe(false);
    expect(never.total).toBe(2);
  });
});
