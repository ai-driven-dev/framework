import { describe, expect, it } from "vitest";
import { expected } from "../../../../../src/contexts/telemetry/domain/transcript/line-values.js";

describe("reading an expected field", () => {
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
