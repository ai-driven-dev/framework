import { describe, expect, it } from "vitest";
import {
  isErrnoException,
  tryParseJson,
  whenAbsent,
} from "../../../../src/shared/domain/reading/json-file.js";

describe("recognising a filesystem failure", () => {
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

describe("parsing JSON text", () => {
  it("returns the parsed value", () => {
    expect(tryParseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it("returns a parsed null as a value, not as a failure", () => {
    expect(tryParseJson("null")).toEqual({ ok: true, value: null });
  });

  it("says so when the text is not JSON, with the parse error", () => {
    expect(tryParseJson("{nope")).toEqual({ ok: false, error: expect.any(SyntaxError) });
    expect(tryParseJson("")).toEqual({ ok: false, error: expect.any(SyntaxError) });
  });

  it("says so when there is no text at all, which JSON.parse would read as null", () => {
    expect(tryParseJson(null)).toEqual({ ok: false, error: null });
  });
});

describe("falling back when a read finds nothing", () => {
  const failing = (code: string) => () => Promise.reject(Object.assign(new Error("x"), { code }));

  it("returns what the read returns", async () => {
    expect(await whenAbsent(() => Promise.resolve("here"), null)).toBe("here");
  });

  it("returns the fallback when the read finds nothing there", async () => {
    expect(await whenAbsent(failing("ENOENT"), "fallback")).toBe("fallback");
  });

  it("rethrows any other failure", async () => {
    await expect(whenAbsent(failing("EACCES"), null)).rejects.toThrow("x");
  });
});
