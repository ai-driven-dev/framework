import { describe, expect, it } from "vitest";
import { bridgeHookCalls } from "../../../../../src/contexts/tools/domain/hooks/plugin-hooks-shape.js";

const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";

function matcherFor(matcher: string): string | undefined {
  const [call] = bridgeHookCalls([
    { matcher, hooks: [{ type: "command", command: `node ${ROOT}/hooks/check.cjs` }] },
  ]);
  return call?.matcher;
}

describe("a bridged matcher", () => {
  it.each([
    ["Write", "Write|apply_patch"],
    ["Edit", "Edit|apply_patch"],
    ["bash|edit", "bash|edit|apply_patch"],
  ])(
    "naming a file write (%s) also names apply_patch, as Codex matches its own",
    (given, bridged) => {
      expect(matcherFor(given)).toBe(bridged);
    }
  );

  it("naming no file write is kept as written", () => {
    expect(matcherFor("Bash|Shell")).toBe("Bash|Shell");
  });

  it("already naming apply_patch is kept as written", () => {
    expect(matcherFor("Edit|apply_patch")).toBe("Edit|apply_patch");
  });
});
