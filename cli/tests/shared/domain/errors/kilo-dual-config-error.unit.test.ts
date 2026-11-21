import { describe, expect, it } from "vitest";
import { KiloDualConfigError } from "../../../../src/shared/domain/errors/kilo-dual-config-error.js";

describe("KiloDualConfigError", () => {
  it("says exactly what went wrong", () => {
    const error = new KiloDualConfigError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "KiloDualConfigError",
      message: "Both Kilo JSON and JSONC config variants exist at the same location. Remove one.",
    });
  });

  it("carries its stable code", () => {
    expect(new KiloDualConfigError().code).toBe("kilo-dual-config");
  });
});
