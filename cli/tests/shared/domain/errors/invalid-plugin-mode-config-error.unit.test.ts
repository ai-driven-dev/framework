import { describe, expect, it } from "vitest";
import { InvalidPluginModeConfigError } from "../../../../src/shared/domain/errors/invalid-plugin-mode-config-error.js";

describe("InvalidPluginModeConfigError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidPluginModeConfigError("bad mode");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidPluginModeConfigError",
      message: "bad mode",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidPluginModeConfigError("bad mode").code).toBe("invalid-plugin-mode-config");
  });
});
