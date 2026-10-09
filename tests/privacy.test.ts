import { describe, expect, it } from "vitest";
import { MASK, maskEmails, maskIf } from "@/lib/privacy";

describe("hiding email addresses for demos", () => {
  it("hides the part before the @ and keeps the domain", () => {
    expect(maskEmails("someone@gmail.com")).toBe(`${MASK}@gmail.com`);
    expect(maskEmails("Maria K. <maria.k+news@mail.example.co.uk>")).toBe(`Maria K. <${MASK}@mail.example.co.uk>`);
  });
  it("finds every address inside free text such as subjects and filter criteria", () => {
    expect(maskEmails("Fwd: alert for a.b@x.io and c_d@y.dev")).toBe(`Fwd: alert for ${MASK}@x.io and ${MASK}@y.dev`);
    expect(maskEmails("from:(jobs-noreply@linkedin.com OR uber.com)")).toBe(`from:(${MASK}@linkedin.com OR uber.com)`);
  });
  it("leaves text without addresses alone, and shows everything when off", () => {
    expect(maskEmails("Your order from Target")).toBe("Your order from Target");
    expect(maskIf(false, "someone@gmail.com")).toBe("someone@gmail.com");
    expect(maskIf(true, null)).toBe("");
  });
});
