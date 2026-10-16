import { describe, expect, it } from "vitest";
import { compareText } from "../../../../src/contexts/telemetry/domain/text-order.js";

describe("ordering text", () => {
  it("puts the smaller first", () => {
    expect(compareText("a", "b")).toBe(-1);
    expect(compareText("b", "a")).toBe(1);
  });

  it("calls equal text equal", () => {
    expect(compareText("a", "a")).toBe(0);
  });

  it("orders by code unit, not by locale: capitals before lower case", () => {
    expect(["b", "B", "a", "A"].sort(compareText)).toEqual(["A", "B", "a", "b"]);
  });

  it("puts a prefix before what extends it", () => {
    expect(compareText("ab", "abc")).toBe(-1);
  });
});
