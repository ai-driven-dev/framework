import { describe, expect, it } from "vitest";
import {
  counter,
  hasOnly,
  isCount,
  isInstant,
  isListed,
  isNullableText,
  linesIn,
  text,
} from "../../../../src/contexts/telemetry/domain/read-back.js";

describe("reading a count", () => {
  it("accepts a whole number of zero or more and nothing else", () => {
    expect(isCount(0)).toBe(true);
    expect(isCount(7)).toBe(true);
    expect(isCount(-1)).toBe(false);
    expect(isCount(1.5)).toBe(false);
    expect(isCount("3")).toBe(false);
    expect(isCount(true)).toBe(false);
  });

  it("is the count, or null", () => {
    expect(counter(7)).toBe(7);
    expect(counter("3")).toBeNull();
  });
});

describe("reading a text", () => {
  it("accepts a non-empty string and nothing else", () => {
    expect(text("a")).toBe("a");
    expect(text("")).toBeNull();
    expect(text(4)).toBeNull();
  });

  it("accepts null or any string where a text may be missing", () => {
    expect(isNullableText(null)).toBe(true);
    expect(isNullableText("")).toBe(true);
    expect(isNullableText(4)).toBe(false);
    expect(isNullableText(undefined)).toBe(false);
  });
});

describe("reading an instant", () => {
  it("accepts a text a date parses from and nothing else", () => {
    expect(isInstant("2026-01-01T00:00:00.000Z")).toBe(true);
    expect(isInstant("soon")).toBe(false);
    expect(isInstant(0)).toBe(false);
  });
});

describe("reading a value from a list", () => {
  it("accepts a member and nothing else", () => {
    expect(isListed(["a", "b"], "b")).toBe(true);
    expect(isListed(["a", "b"], "c")).toBe(false);
  });
});

describe("reading the lines of a text", () => {
  it("is every line that holds something, and none for no text", () => {
    expect(linesIn("a\n\nb\n")).toStrictEqual(["a", "b"]);
    expect(linesIn(null)).toStrictEqual([]);
  });
});

describe("reading an object of known fields", () => {
  it("accepts the fields named, or fewer, and refuses any other", () => {
    expect(hasOnly({ a: 1, b: 2 }, ["a", "b"])).toBe(true);
    expect(hasOnly({ a: 1 }, ["a", "b"])).toBe(true);
    expect(hasOnly({ a: 1, c: 3 }, ["a", "b"])).toBe(false);
  });
});
