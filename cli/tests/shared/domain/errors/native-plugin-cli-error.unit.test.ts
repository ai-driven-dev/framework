import { describe, expect, it } from "vitest";
import { NativePluginCliError } from "../../../../src/shared/domain/errors/native-plugin-cli-error.js";

describe("NativePluginCliError", () => {
  it("says exactly what went wrong", () => {
    const error = new NativePluginCliError("claude exited 2");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "NativePluginCliError",
      message: "claude exited 2",
    });
  });

  it("carries its stable code", () => {
    expect(new NativePluginCliError("claude exited 2").code).toBe("native-plugin-cli");
  });
});
