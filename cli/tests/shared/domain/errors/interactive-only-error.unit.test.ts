import { describe, expect, it } from "vitest";
import { InteractiveOnlyError } from "../../../../src/shared/domain/errors/interactive-only-error.js";

describe("InteractiveOnlyError", () => {
  it("says exactly what went wrong", () => {
    const error = new InteractiveOnlyError("aidd setup");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InteractiveOnlyError",
      message: "'aidd setup' requires an interactive terminal.",
    });
  });

  it("carries its stable code", () => {
    expect(new InteractiveOnlyError("aidd setup").code).toBe("interactive-only");
  });
});
