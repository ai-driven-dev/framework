import { describe, expect, it } from "vitest";
import { FlatTargetExistsError } from "../../../../src/shared/domain/errors/flat-target-exists-error.js";

describe("FlatTargetExistsError", () => {
  it("says exactly what went wrong", () => {
    const error = new FlatTargetExistsError("/out/a.md", "aidd-dev");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "FlatTargetExistsError",
      message:
        "Flat build conflict: '/out/a.md' already exists (plugin 'aidd-dev'). Re-run with --force to overwrite.",
    });
  });

  it("carries its stable code", () => {
    expect(new FlatTargetExistsError("/out/a.md", "aidd-dev").code).toBe("flat-target-exists");
  });
});
