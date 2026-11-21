import { describe, expect, it } from "vitest";
import { PluginFetchError } from "../../../../src/shared/domain/errors/plugin-fetch-error.js";

describe("PluginFetchError", () => {
  it("says exactly what went wrong", () => {
    const error = new PluginFetchError("clone refused");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "PluginFetchError",
      message: "Failed to fetch plugin: clone refused",
    });
  });

  it("carries its stable code", () => {
    expect(new PluginFetchError("clone refused").code).toBe("plugin-fetch");
  });
});
