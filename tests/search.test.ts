import { describe, expect, it } from "vitest";
import { detectFlags, explicitDateRange, residualTopic, senderCandidates, timeToGmail } from "@/lib/search/compile";

const now = new Date(Date.UTC(2026, 8, 25, 12));

describe("explicit dates", () => {
  it("resolves month names to the most recent past occurrence", () => {
    expect(explicitDateRange("receipts from march", now)?.gmail).toBe("after:2026/03/01 before:2026/04/01");
    expect(explicitDateRange("flights in november", now)?.gmail).toBe("after:2025/11/01 before:2025/12/01");
    expect(explicitDateRange("statements from december 2024", now)?.gmail).toBe("after:2024/12/01 before:2025/01/01");
  });
  it("turns relative spans into newer_than", () => {
    expect(explicitDateRange("last 3 weeks", now)?.gmail).toBe("newer_than:21d");
    expect(explicitDateRange("past 2 months of receipts", now)?.gmail).toBe("newer_than:60d");
  });
  it("leaves fuzzy time words to the model", () => {
    expect(explicitDateRange("recent receipts", now)).toBeNull();
    expect(timeToGmail("last_30_days", now)).toBe("newer_than:30d");
    expect(timeToGmail("last_year", now)).toBe("after:2025/01/01 before:2026/01/01");
  });
});

describe("flags and senders", () => {
  it("detects status words", () => {
    expect(detectFlags("unread mail with attachments I never answered")).toEqual(expect.arrayContaining(["unread", "attachments", "needsReply"]));
    expect(detectFlags("what can I trash")).toContain("trashCandidates");
  });
  it("finds sender candidates from explicit domains and known senders", () => {
    const known = [{ domain: "uber.com", name: "Uber Receipts" }, { domain: "em.target.com", name: "Target" }, { domain: "chase.com", name: "Chase" }];
    const c = senderCandidates("receipts from uber last month", known);
    expect(c.map((s) => s.domain)).toEqual(["uber.com"]);
    expect(senderCandidates("anything from billing@acme.io", known).map((s) => s.domain)).toContain("billing@acme.io");
    expect(senderCandidates("mail from target about shoes", known).map((s) => s.domain)).toEqual(["em.target.com"]);
  });
  it("strips recognized words to leave the topic", () => {
    expect(residualTopic("receipts from uber last month", [{ domain: "uber.com", name: "Uber" }], [])).toBe("");
    expect(residualTopic("emails about the tokyo apartment lease from march", [], [])).toBe("tokyo apartment lease");
  });
});
