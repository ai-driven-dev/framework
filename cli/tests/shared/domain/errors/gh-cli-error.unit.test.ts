import { describe, expect, it } from "vitest";
import { GhCliError } from "../../../../src/shared/domain/errors/gh-cli-error.js";

describe("GhCliError", () => {
  it("says exactly what went wrong", () => {
    const error = new GhCliError("gh exited 1");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "GhCliError",
      message: "gh exited 1",
    });
  });

  it("carries its stable code", () => {
    expect(new GhCliError("gh exited 1").code).toBe("gh-cli");
  });
});
