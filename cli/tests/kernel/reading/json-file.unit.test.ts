import { describe, expect, it } from "vitest";
import { asPlainObjectOrEmpty, isErrnoException } from "../../../src/kernel/reading/json-file.js";

describe("asPlainObjectOrEmpty", () => {
  it("passes a plain object through unchanged", () => {
    const value = { a: 1 };
    expect(asPlainObjectOrEmpty(value)).toBe(value);
  });

  it("reads null as an empty object", () => {
    expect(asPlainObjectOrEmpty(null)).toStrictEqual({});
  });

  it("reads an array as an empty object", () => {
    expect(asPlainObjectOrEmpty([1])).toStrictEqual({});
  });

  it("reads a primitive as an empty object", () => {
    expect(asPlainObjectOrEmpty("text")).toStrictEqual({});
  });
});

describe("isErrnoException", () => {
  it("recognises an Error carrying a code", () => {
    expect(isErrnoException(Object.assign(new Error("gone"), { code: "ENOENT" }))).toBe(true);
  });

  it("refuses an Error carrying no code", () => {
    expect(isErrnoException(new Error("gone"))).toBe(false);
  });

  it("refuses a plain object carrying a code", () => {
    expect(isErrnoException({ code: "ENOENT" })).toBe(false);
  });
});
