import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CODEX_ROLLOUT_LOCATION } from "../../../../../../src/contexts/tools/domain/profiles/codex/codex-transcript-location.js";

describe("where Codex keeps a session's rollout", () => {
  it("claims no file that is not a rollout, even one named for the session", () => {
    expect(
      CODEX_ROLLOUT_LOCATION.matches(join("2026", "01", "02", "history-abc.jsonl"), "abc")
    ).toBe(false);
  });
});
