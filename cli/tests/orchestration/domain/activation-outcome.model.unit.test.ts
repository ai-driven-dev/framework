import { describe, expect, it } from "vitest";
import { assertActivated } from "../../../src/orchestration/domain/activation-outcome.model.js";
import { SyncFailedError } from "../../../src/orchestration/orchestration.error.js";

describe("assertActivated", () => {
  it("lets an activation that did not fail through, warnings or not", () => {
    expect(() =>
      assertActivated({ errors: [{ scope: "claude", message: "x" }], failed: false })
    ).not.toThrow();
  });

  it("throws naming the scopes of a failed activation", () => {
    expect(() =>
      assertActivated({
        errors: [
          { scope: "claude", message: "x" },
          { scope: "codex", message: "y" },
        ],
        failed: true,
      })
    ).toThrow(
      new SyncFailedError([
        { scope: "claude", message: "" },
        { scope: "codex", message: "" },
      ])
    );
  });
});
