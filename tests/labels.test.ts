import { describe, expect, it } from "vitest";
import { expandLabelQuery } from "@/lib/gmail/labels";

const LABELS = ["Receipts", "Receipts/Uber", "Receipts/DoorDash", "Receipts/Amazon", "Dev Notifications", "Dev Notifications/GitHub", "Work", "Newsletters"];

describe("expandLabelQuery", () => {
  it("expands a parent label to itself plus every sublabel", () => {
    expect(expandLabelQuery('label:"Receipts" newer_than:30d -in:trash', LABELS)).toBe(
      '(label:"Receipts" OR label:"Receipts/Amazon" OR label:"Receipts/DoorDash" OR label:"Receipts/Uber") newer_than:30d -in:trash',
    );
  });
  it("leaves labels without children alone", () => {
    expect(expandLabelQuery('in:inbox label:"Work" older_than:2d', LABELS)).toBe('in:inbox label:"Work" older_than:2d');
  });
  it("expands every token in a query, including negated ones", () => {
    expect(expandLabelQuery('label:"Dev Notifications" -label:"Receipts"', LABELS)).toBe(
      '(label:"Dev Notifications" OR label:"Dev Notifications/GitHub") -(label:"Receipts" OR label:"Receipts/Amazon" OR label:"Receipts/DoorDash" OR label:"Receipts/Uber")',
    );
  });
  it("does not treat a prefix as a parent", () => {
    expect(expandLabelQuery('label:"Work"', ["Work", "Workouts/Log"])).toBe('label:"Work"');
  });
});
