import { describe, expect, it } from "vitest";
import { ToolNotInManifestError } from "../../../../src/shared/domain/errors/tool-not-in-manifest-error.js";

describe("ToolNotInManifestError", () => {
  it("says exactly what went wrong", () => {
    const error = new ToolNotInManifestError("zed");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ToolNotInManifestError",
      message: "Tool 'zed' is not installed in the manifest.",
    });
  });

  it("carries its stable code", () => {
    expect(new ToolNotInManifestError("zed").code).toBe("tool-not-in-manifest");
  });
});
