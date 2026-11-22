import { describe, expect, it } from "vitest";
import { BulkConflictState } from "../../../src/orchestration/domain/bulk-conflict-state.js";

describe("remembering a bulk conflict decision", () => {
  it("holds no decision until one is recorded", () => {
    expect(new BulkConflictState().get()).toBeNull();
  });

  it("returns the recorded decision", () => {
    const state = new BulkConflictState();

    state.record("skip-all");

    expect(state.get()).toBe("skip-all");
  });

  it("keeps the last decision recorded", () => {
    const state = new BulkConflictState();

    state.record("skip-all");
    state.record("overwrite-all");

    expect(state.get()).toBe("overwrite-all");
  });
});
