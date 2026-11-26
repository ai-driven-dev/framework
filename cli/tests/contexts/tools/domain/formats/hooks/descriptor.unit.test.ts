import { describe, expect, it } from "vitest";
import { CANONICAL_HOOK_EVENTS } from "../../../../../../src/contexts/tools/domain/formats/hooks/descriptor.js";

describe("what every plugin's hooks share, whichever tool runs them", () => {
  it("names the events a plugin may hook", () => {
    expect(CANONICAL_HOOK_EVENTS).toEqual([
      "SessionStart",
      "UserPromptSubmit",
      "PreToolUse",
      "PostToolUse",
      "Stop",
      "SessionEnd",
      "SubagentStop",
    ]);
  });
});
