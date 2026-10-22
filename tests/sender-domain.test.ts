import { describe, expect, it } from "vitest";
import { domainOf } from "@/lib/engine/senders";
import { buildRules } from "@/lib/policy/rules";
import { policyRoutes } from "@/lib/policy/routes";
import { defaultPolicy } from "@/lib/policy/schema";

/**
 * Security audit 2026-10 (docs/security/2026-10-audit.md): a sender's domain comes from a From header anyone can
 * write, and a sender decision drops it straight into Gmail searches (`from:x older_than:…`, `-from:(a OR b)`). The
 * address is the LAST <…> (a display name may carry one of its own), only a hostname counts as a domain, and a stored
 * sender entry Gmail would read as syntax (spaces, braces, parentheses, quotes) never reaches a query.
 */
describe("sender domains from untrusted From headers", () => {
  it("the address is the last <…>, not one hidden in the display name", () => {
    expect(domainOf('"Deals <x@{evil.example bank.example}>" <news@evil.example>').domain).toBe("evil.example");
    expect(domainOf('"Target" <hello@em.target.com>')).toEqual({ domain: "em.target.com", name: "Target" });
  });

  it("only a hostname is a domain", () => {
    for (const from of ["<x@{evil.example bank.example}>", "x@(a OR b)", "<x@evil.example -label:keep>", '<x@"q".example>']) {
      expect(domainOf(from).domain, from).toBe("");
    }
  });
});

describe("stored sender entries never become query syntax", () => {
  const policy = defaultPolicy();
  policy.senders.trashAfterDays = { "{evil.example bank.example}": 1, "ok.example": 30 };
  policy.senders.protected = ["friend.example", "x) OR (from:bank.example"];
  policy.senders.heavyPromo = ["promo.example", "a b"];

  it("rules keep the good entries and drop the ones Gmail would parse", () => {
    const rules = buildRules(policy);
    const queries = rules.map((r) => r.query).join("\n");
    expect(rules.map((r) => r.id)).toContain("trash-sender:ok.example");
    expect(rules.map((r) => r.id)).not.toContain("trash-sender:{evil.example bank.example}");
    expect(queries).not.toMatch(/[{}]|bank\.example|\ba b\b/);
    expect(queries).toContain("friend.example");
    expect(queries).toContain("promo.example");
  });

  it("filing routes from the sender lists drop them too", () => {
    const p = defaultPolicy();
    p.senders.work = ["work.example", "{a b}"];
    p.senders.family = ["mom.example", "x) OR (y"];
    const froms = policyRoutes(p).filter((r) => r.origin === "senders").map((r) => r.route.from ?? "").join("\n");
    expect(froms).toContain("work.example");
    expect(froms).toContain("mom.example");
    expect(froms).not.toMatch(/[{}()]/);
  });
});
