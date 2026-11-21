import { describe, expect, it } from "vitest";
import { MissingPluginMetadataError } from "../../../../src/shared/domain/errors/missing-plugin-metadata-error.js";

describe("MissingPluginMetadataError", () => {
  it("says exactly what went wrong", () => {
    const error = new MissingPluginMetadataError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "MissingPluginMetadataError",
      message:
        "Cannot register github marketplace plugin: catalog entry is missing plugin metadata.",
    });
  });

  it("carries its stable code", () => {
    expect(new MissingPluginMetadataError().code).toBe("missing-plugin-metadata");
  });
});
