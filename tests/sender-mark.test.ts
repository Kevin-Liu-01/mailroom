import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { brandForDomain, SenderMark } from "@/components/app/Bits";

/**
 * Security audit 2026-10 (docs/security/2026-10-audit.md): the sender's domain comes from a From header anyone can
 * write. A domain label named after a member every object inherits (`constructor`, `__proto__`, `toString`…) must not
 * count as a known brand; it used to pick the inherited member, and rendering that "brand" threw, taking the
 * dashboard, search results and run receipts down for as long as such a message was listed.
 */
const INHERITED = ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty", "isPrototypeOf", "__defineGetter__"];

describe("sender marks from untrusted domains", () => {
  it("a domain label named after an inherited member is no brand", () => {
    for (const label of INHERITED) expect(brandForDomain(`${label}.example.com`), label).toBeNull();
  });

  it("such a sender renders as initials, not a crash", () => {
    for (const label of INHERITED) {
      const html = renderToString(createElement(SenderMark, { from: `Mallory <m@${label}.example.com>` }));
      expect(html, label).toContain("M");
    }
  });

  it("known brands still resolve", () => {
    expect(brandForDomain("github.com")).not.toBeNull();
  });
});
