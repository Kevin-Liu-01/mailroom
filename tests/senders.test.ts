import { describe, expect, it } from "vitest";
import { domainOf, recommend } from "@/lib/engine/senders";
import { defaultPolicy } from "@/lib/policy/schema";

const policy = defaultPolicy();
const base = { category: "marketing", categoryConfidence: 0.9, safeToTrashOld: 0.95, transactional: 0.05, human: 0.02 };

describe("sender recommendations", () => {
  it("parses From headers", () => {
    expect(domainOf('"Target" <hello@em.target.com>')).toEqual({ domain: "em.target.com", name: "Target" });
    expect(domainOf("mom@gmail.com").domain).toBe("gmail.com");
  });
  it("never-opened bulk senders get trash-all, occasionally-opened get trash-old", () => {
    expect(recommend({ domain: "em.target.com", messages: 40, unread: 39, judgment: base, decision: null }, policy).rec).toBe("trash-all");
    expect(recommend({ domain: "em.target.com", messages: 40, unread: 20, judgment: base, decision: null }, policy).rec).toBe("trash-old");
  });
  it("humans, records, and protected categories are protected", () => {
    expect(recommend({ domain: "gmail.com", messages: 10, unread: 0, judgment: { ...base, human: 0.9 }, decision: null }, policy).rec).toBe("protect");
    expect(recommend({ domain: "chase.com", messages: 10, unread: 9, judgment: { ...base, transactional: 0.8 }, decision: null }, policy).rec).toBe("protect");
    expect(recommend({ domain: "x.com", messages: 10, unread: 9, judgment: { ...base, category: "work" }, decision: null }, policy).rec).toBe("protect");
  });
  it("user decisions and policy lists win", () => {
    expect(recommend({ domain: "em.target.com", messages: 40, unread: 39, judgment: base, decision: "protect" }, policy).rec).toBe("protect");
    const p = defaultPolicy({ senders: { heavyPromo: [], work: [], family: [], protected: ["em.target.com"], trashAfterDays: {} } });
    expect(recommend({ domain: "em.target.com", messages: 40, unread: 39, judgment: base, decision: null }, p).rec).toBe("protect");
  });
});
