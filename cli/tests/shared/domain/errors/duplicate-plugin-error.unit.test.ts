import { describe, expect, it } from "vitest";
import { DuplicatePluginError } from "../../../../src/shared/domain/errors/duplicate-plugin-error.js";

describe("DuplicatePluginError", () => {
  it("says exactly what went wrong", () => {
    const error = new DuplicatePluginError("aidd-dev");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "DuplicatePluginError",
      message: "Plugin 'aidd-dev' is already installed.",
    });
  });

  it("carries its stable code", () => {
    expect(new DuplicatePluginError("aidd-dev").code).toBe("duplicate-plugin");
  });
});
