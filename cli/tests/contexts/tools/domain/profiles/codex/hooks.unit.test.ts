import { describe, expect, it } from "vitest";
import {
  codex,
  mergeCodexHooksJson,
} from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";

describe("codex hooks", () => {
  describe("capabilities.hooks", () => {
    it("outputs to .codex/hooks.json", () => {
      expect(codex.capabilities.hooks.buildOutputPath()).toBe(".codex/hooks.json");
    });

    it("consumes the codex-hooks config name", () => {
      expect(codex.capabilities.hooks.consumes).toContain("codex-hooks");
    });

    it("uses user-prime merge strategy", () => {
      expect(codex.capabilities.hooks.getMergeStrategy()).toBe("user-prime");
    });

    it("uses SessionStart as entry section", () => {
      expect(codex.capabilities.hooks.getEntrySection()).toBe("SessionStart");
    });

    it("returns null entry section for unknown config names", () => {
      const cap = [codex.capabilities.mcp, codex.capabilities.hooks].find((c) =>
        c.consumes.includes("unknown")
      );
      expect(cap).toBeUndefined();
    });
  });
});

describe("mergeCodexHooksJson()", () => {
  const AIDD_ENTRY = {
    matcher: "startup|resume",
    hooks: [
      {
        type: "command",
        command: "node .aidd/scripts/update_memory.cjs",
        statusMessage: "Syncing AIDD memory...",
        timeout: 30,
      },
    ],
  };

  it("subscribes the memory refresh to a fresh session, on startup and on resume", () => {
    expect(mergeCodexHooksJson("")).toBe(JSON.stringify({ SessionStart: [AIDD_ENTRY] }, null, 2));
  });

  it("keeps a user's own hooks and appends the memory refresh after them", () => {
    const existing = JSON.stringify({
      PreToolUse: [{ hooks: [{ type: "command", command: "user.sh" }] }],
      SessionStart: [{ hooks: [{ type: "command", command: "user-start.sh" }] }],
    });

    expect(mergeCodexHooksJson(existing)).toBe(
      JSON.stringify(
        {
          PreToolUse: [{ hooks: [{ type: "command", command: "user.sh" }] }],
          SessionStart: [{ hooks: [{ type: "command", command: "user-start.sh" }] }, AIDD_ENTRY],
        },
        null,
        2
      )
    );
  });

  it("adds nothing on a second run over its own output", () => {
    const once = mergeCodexHooksJson("");
    expect(mergeCodexHooksJson(once)).toBe(once);
  });

  it("finds its own hook inside any group of a user's SessionStart, and adds no second one", () => {
    const existing = JSON.stringify(
      {
        SessionStart: [
          { hooks: [{ type: "command", command: "user-start.sh" }] },
          { hooks: [{ type: "command", command: "user-two.sh" }, AIDD_ENTRY.hooks[0]] },
        ],
      },
      null,
      2
    );

    expect(mergeCodexHooksJson(existing)).toBe(existing);
  });

  it("starts over from a file it cannot read rather than failing the install", () => {
    expect(mergeCodexHooksJson("{ not json")).toBe(
      JSON.stringify({ SessionStart: [AIDD_ENTRY] }, null, 2)
    );
  });
});
