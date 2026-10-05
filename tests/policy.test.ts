import { describe, expect, it } from "vitest";
import { defaultPolicy, parsePolicy } from "@/lib/policy/schema";
import { buildFilters, buildRules, resolveRule } from "@/lib/policy/rules";

describe("policy defaults", () => {
  it("parses an empty override into the opinionated defaults", () => {
    const p = defaultPolicy();
    expect(p.categories.skipInbox).toEqual(["dev", "receipts"]);
    expect(p.aging.trashMarketingAfterDays).toBeNull();
    expect(p.ai.enabled).toBe(true);
  });
  it("rejects unknown categories and out-of-range numbers", () => {
    expect(() => parsePolicy({ version: 1, categories: { skipInbox: ["nope"] } })).toThrow();
    expect(() => parsePolicy({ version: 1, aging: { archiveStragglersAfterDays: 0 } })).toThrow();
  });
});

describe("rules", () => {
  const p = defaultPolicy();
  const rules = buildRules(p);
  it("never trashes protected categories", () => {
    const protectedLabels = ["Work", "Personal", "Banking & Finance", "Trips & Travel", "Events", "Recruiting", "School"];
    for (const r of rules.filter((r) => r.kind === "trash")) {
      for (const label of protectedLabels) expect(r.query).not.toContain(`label:"${label}"`);
    }
  });
  it("only ever moves to TRASH, never deletes", () => {
    for (const r of rules) expect(r.addLabelIds.every((l) => ["TRASH"].includes(l) || !l.startsWith("SYSTEM"))).toBe(true);
  });
  it("keeps promotions in their tab by default", () => {
    expect(rules.find((r) => r.id === "trash-old-marketing")).toBeUndefined();
    expect(rules.find((r) => r.id === "mark-read-old-promotions")?.query).toContain("category:promotions");
  });
  it("adds a trash rule for marketing only when opted in, and skips protected labels", () => {
    const opted = buildRules(parsePolicy({ version: 1, aging: { trashMarketingAfterDays: 365 } }));
    expect(opted.find((r) => r.id === "trash-old-marketing")?.query).toContain("older_than:365d");
    const protectedMarketing = buildRules(parsePolicy({ version: 1, aging: { trashMarketingAfterDays: 365 }, categories: { protected: ["marketing"] } }));
    expect(protectedMarketing.find((r) => r.id === "trash-old-marketing")).toBeUndefined();
  });
  it("resolves label names to ids", () => {
    const r = resolveRule({ id: "x", kind: "archive", query: "", addLabelIds: ["Work"], removeLabelIds: ["INBOX"], why: "" }, { Work: "Label_1" });
    expect(r.addLabelIds).toEqual(["Label_1"]);
    expect(r.removeLabelIds).toEqual(["INBOX"]);
  });
  it("excludes starred mail from every trash rule", () => {
    for (const r of rules.filter((r) => r.kind === "trash")) expect(r.query).toContain("-is:starred");
  });
});

describe("filters", () => {
  it("skip-inbox categories remove INBOX and never-important categories remove IMPORTANT", () => {
    const specs = buildFilters(defaultPolicy());
    const dev = specs.find((s) => s.id === "dev-github")!;
    expect(dev.action.removeLabelIds).toEqual(["INBOX", "IMPORTANT"]);
    const finance = specs.find((s) => s.id === "finance")!;
    expect(finance.action.removeLabelIds).toEqual([]);
  });
  it("adds sender-driven filters only when lists are non-empty", () => {
    expect(buildFilters(defaultPolicy()).some((s) => s.id === "heavy-promo")).toBe(false);
    expect(buildFilters(parsePolicy({ version: 1, senders: { heavyPromo: ["em.target.com"] } })).some((s) => s.id === "heavy-promo")).toBe(true);
  });
});
