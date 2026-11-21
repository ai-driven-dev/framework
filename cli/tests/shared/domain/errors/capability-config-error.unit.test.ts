import { describe, expect, it } from "vitest";
import { CapabilityConfigError } from "../../../../src/shared/domain/errors/capability-config-error.js";

describe("CapabilityConfigError", () => {
  it("says exactly what went wrong", () => {
    const error = new CapabilityConfigError("cap broke");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "CapabilityConfigError",
      message: "cap broke",
    });
  });

  it("carries its stable code", () => {
    expect(new CapabilityConfigError("cap broke").code).toBe("capability-config");
  });
});
