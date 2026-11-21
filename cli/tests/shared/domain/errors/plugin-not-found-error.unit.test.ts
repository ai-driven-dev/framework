import { describe, expect, it } from "vitest";
import { PluginNotFoundError } from "../../../../src/shared/domain/errors/plugin-not-found-error.js";

describe("PluginNotFoundError", () => {
  it("says exactly what went wrong", () => {
    const error = new PluginNotFoundError("aidd-dev");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "PluginNotFoundError",
      message: "Plugin 'aidd-dev' is not installed.",
    });
  });

  it("carries its stable code", () => {
    expect(new PluginNotFoundError("aidd-dev").code).toBe("plugin-not-found");
  });
});
