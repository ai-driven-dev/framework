import { describe, expect, it } from "vitest";
import { SyncFailedError } from "../../../../src/shared/domain/errors/sync-failed-error.js";

describe("SyncFailedError", () => {
  it("says exactly what went wrong", () => {
    const error = new SyncFailedError([
      { scope: "claude", message: "x" },
      { scope: "codex", message: "y" },
    ]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "SyncFailedError",
      message: "Sync failed for: claude, codex. See the warnings above.",
    });
  });

  it("carries its stable code", () => {
    expect(
      new SyncFailedError([
        { scope: "claude", message: "x" },
        { scope: "codex", message: "y" },
      ]).code
    ).toBe("sync-failed");
  });
});
