import { describe, expect, it } from "vitest";
import { isErrnoException, tryParseJson } from "../../../src/kernel/reading/json-file.js";

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

describe("tryParseJson", () => {
  it("returns the parsed value", () => {
    expect(tryParseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it("returns a parsed null as a value, not as a failure", () => {
    expect(tryParseJson("null")).toEqual({ ok: true, value: null });
  });

  it("says so when the text is not JSON", () => {
    expect(tryParseJson("{nope")).toEqual({ ok: false });
    expect(tryParseJson("")).toEqual({ ok: false });
  });
});
