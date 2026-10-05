import { describe, expect, it } from "vitest";
import { quotaCost } from "@/lib/gmail/client";

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
