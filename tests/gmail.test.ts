import { describe, expect, it } from "vitest";
import { quotaCost, takenBackFrom } from "@/lib/gmail/client";

describe("Gmail quota costs", () => {
  it("prices reads as Gmail meters them, searches and writes at the published rate", () => {
    expect(quotaCost("/messages?q=x")).toBe(5);
    expect(quotaCost("/messages/abc?format=metadata")).toBe(20);
    expect(quotaCost("/messages/batchModify", "POST")).toBe(50);
    expect(quotaCost("/threads/abc?format=metadata")).toBe(20);
    expect(quotaCost("/labels")).toBe(1);
    expect(quotaCost("/settings/filters", "POST")).toBe(5);
    expect(quotaCost("/profile")).toBe(1);
  });
});

describe("what people took back", () => {
  it("finds messages restored from Trash and messages moved back to the inbox", () => {
    const back = takenBackFrom([
      { labelsRemoved: [{ message: { id: "a" }, labelIds: ["TRASH"] }] },
      { labelsAdded: [{ message: { id: "a" }, labelIds: ["INBOX"] }, { message: { id: "b" }, labelIds: ["INBOX", "UNREAD"] }] },
      { labelsAdded: [{ message: { id: "c" }, labelIds: ["Label_7"] }], labelsRemoved: [{ message: { id: "d" }, labelIds: ["INBOX"] }] },
    ]);
    expect(back.restored).toEqual(["a"]);
    expect(back.inboxed).toEqual(["b"]);
  });
  it("prices history reads", () => {
    expect(quotaCost("/history?startHistoryId=1")).toBe(2);
  });
});
