import { describe, expect, it } from "vitest";
import { FrameworkPlaceholderInPluginError } from "../../../../src/shared/domain/errors/framework-placeholder-in-plugin-error.js";

describe("FrameworkPlaceholderInPluginError", () => {
  it("says exactly what went wrong", () => {
    const error = new FrameworkPlaceholderInPluginError("aidd-dev", "skills/x.md");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "FrameworkPlaceholderInPluginError",
      message:
        "Framework placeholder '@{{TOOLS}}/' is not allowed inside plugin 'aidd-dev' (file: skills/x.md).",
    });
  });

  it("carries its stable code", () => {
    expect(new FrameworkPlaceholderInPluginError("aidd-dev", "skills/x.md").code).toBe(
      "framework-placeholder-in-plugin"
    );
  });
});
