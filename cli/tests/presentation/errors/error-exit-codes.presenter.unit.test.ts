import { describe, expect, it } from "vitest";
import { EXIT_CODES } from "../../../src/presentation/errors/error-exit-codes.presenter.js";
import { MESSAGES } from "../../../src/presentation/errors/error-messages.presenter.js";

describe("the exit codes of the catalogued errors", () => {
  it("gives every catalogued error code an entry, and no other", () => {
    expect(Object.keys(EXIT_CODES).sort()).toEqual(Object.keys(MESSAGES).sort());
  });

  it("ends every catalogued error with exit code 1", () => {
    expect(new Set(Object.values(EXIT_CODES))).toEqual(new Set([1]));
  });
});
