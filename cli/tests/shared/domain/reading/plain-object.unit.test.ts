import { describe, expect, it } from "vitest";
import {
  asPlainObject,
  plainObjectIn,
} from "../../../../src/shared/domain/reading/plain-object.js";

describe("narrowing a value to a plain object", () => {
  it("passes a plain object through unchanged", () => {
    const value = { a: 1 };
    expect(asPlainObject(value)).toBe(value);
  });

  it("rejects an array, even though typeof it is also 'object'", () => {
    expect(asPlainObject([1, 2, 3])).toBeNull();
  });

  it("rejects null", () => {
    expect(asPlainObject(null)).toBeNull();
  });

  it("rejects a primitive", () => {
    expect(asPlainObject("a string")).toBeNull();
    expect(asPlainObject(42)).toBeNull();
    expect(asPlainObject(true)).toBeNull();
    expect(asPlainObject(undefined)).toBeNull();
  });
});

describe("reading a plain object out of JSON text", () => {
  it("is the object the text holds", () => {
    expect(plainObjectIn('{"a":1}')).toEqual({ a: 1 });
  });

  it("is null for no text, text that is not JSON, and JSON that is no plain object", () => {
    expect(plainObjectIn(null)).toBeNull();
    expect(plainObjectIn("{nope")).toBeNull();
    expect(plainObjectIn("[1]")).toBeNull();
  });
});
