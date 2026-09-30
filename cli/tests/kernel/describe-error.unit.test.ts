import { describe, expect, it } from "vitest";
import { describeError, errorMessage } from "../../src/kernel/describe-error.js";

describe("describeError", () => {
  it("answers the code of a filesystem failure", () => {
    expect(describeError(Object.assign(new Error("open failed"), { code: "ENOENT" }))).toBe(
      "ENOENT"
    );
  });

  it("answers the message when the code is not a string", () => {
    expect(describeError(Object.assign(new Error("open failed"), { code: 2 }))).toBe("open failed");
  });

  it("answers the message of an Error carrying no code", () => {
    expect(describeError(new SyntaxError("Unexpected token"))).toBe("Unexpected token");
  });

  it("stringifies a thrown value that is not an Error, whatever fields it carries", () => {
    expect(describeError({ code: "ENOENT" })).toBe("[object Object]");
  });
});

describe("errorMessage", () => {
  it("answers an Error's message", () => {
    expect(errorMessage(new Error("bad json"))).toBe("bad json");
  });

  it("stringifies a thrown value that is not an Error", () => {
    expect(errorMessage(42)).toBe("42");
  });
});
