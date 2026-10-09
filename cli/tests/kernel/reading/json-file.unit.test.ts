import { describe, expect, it } from "vitest";
import { isErrnoException } from "../../../src/kernel/reading/json-file.js";

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
