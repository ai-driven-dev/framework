import { describe, expect, it } from "vitest";
import { InvalidPluginSourceError } from "../../../../src/shared/domain/errors/invalid-plugin-source-error.js";

describe("InvalidPluginSourceError", () => {
  it("says exactly what went wrong (1)", () => {
    const error = new InvalidPluginSourceError("no kind");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidPluginSourceError",
      message: "Invalid plugin source: no kind",
    });
  });

  it("says exactly what went wrong (2)", () => {
    const error = new InvalidPluginSourceError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidPluginSourceError",
      message: "Invalid plugin source.",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidPluginSourceError("no kind").code).toBe("invalid-plugin-source");
  });
});
