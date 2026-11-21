import { describe, expect, it } from "vitest";
import { ActiveMachineDependentsError } from "../../../../src/shared/domain/errors/active-machine-dependents-error.js";

describe("ActiveMachineDependentsError", () => {
  it("says exactly what went wrong", () => {
    const error = new ActiveMachineDependentsError("x", ["a", "b"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ActiveMachineDependentsError",
      message: "Cannot remove x: active projects still depend on it: a, b.",
    });
  });

  it("carries its stable code", () => {
    expect(new ActiveMachineDependentsError("x", ["a", "b"]).code).toBe(
      "active-machine-dependents"
    );
  });
});
