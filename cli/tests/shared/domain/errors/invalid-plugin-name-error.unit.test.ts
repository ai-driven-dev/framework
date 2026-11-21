import { describe, expect, it } from "vitest";
import { InvalidPluginNameError } from "../../../../src/shared/domain/errors/invalid-plugin-name-error.js";

describe("InvalidPluginNameError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidPluginNameError("My Plugin");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidPluginNameError",
      message:
        'Invalid plugin name: "My Plugin". Use lowercase alphanumeric characters and hyphens only.',
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidPluginNameError("My Plugin").code).toBe("invalid-plugin-name");
  });
});
