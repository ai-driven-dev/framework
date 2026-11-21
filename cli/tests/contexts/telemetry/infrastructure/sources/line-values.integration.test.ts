import { describe, expect, it } from "vitest";
import {
  counter,
  expected,
  text,
} from "../../../../../src/contexts/telemetry/infrastructure/sources/line-values.js";

describe("counter", () => {
  it("accepts a non-negative integer and nothing else", () => {
    expect(counter(0)).toBe(0);
    expect(counter(7)).toBe(7);
    expect(counter(-1)).toBeNull();
    expect(counter(1.5)).toBeNull();
    expect(counter("3")).toBeNull();
  });
});

describe("text", () => {
  it("accepts a non-empty string and nothing else", () => {
    expect(text("a")).toBe("a");
    expect(text("")).toBeNull();
    expect(text(4)).toBeNull();
  });
});

describe("expected", () => {
  it("returns the count and notes nothing when it is there", () => {
    const notes: string[] = [];
    expect(expected("usage", notes)({ input_tokens: 5 }, "input_tokens")).toBe(5);
    expect(notes).toStrictEqual([]);
  });

  it("returns null and names the field under its place when it is missing or malformed", () => {
    const notes: string[] = [];
    const read = expected("usage", notes);
    expect(read({}, "input_tokens")).toBeNull();
    expect(read({ output_tokens: "x" }, "output_tokens")).toBeNull();
    expect(notes).toStrictEqual([
      "usage.input_tokens is missing or not a count",
      "usage.output_tokens is missing or not a count",
    ]);
  });
});
