import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mergeClaudeSettingsHooks } from "../../../../../../src/contexts/tools/domain/profiles/claude/hooks-format.js";
import { REPOSITORY_ROOT } from "../../../../../helpers/repository-root.js";

describe("mergeClaudeSettingsHooks", () => {
  it("merges plugin hooks into empty settings.json", () => {
    const plugin = JSON.stringify({
      hooks: {
        SessionStart: [
          { hooks: [{ type: "command", command: "node ./.claude/hooks/plugin/run.js" }] },
        ],
      },
    });
    const { content } = mergeClaudeSettingsHooks(null, plugin);
    const result = JSON.parse(content) as { hooks: Record<string, unknown[]> };
    expect(result.hooks.SessionStart).toHaveLength(1);
  });

  it("preserves existing settings keys when merging hooks", () => {
    const existing = JSON.stringify({ model: "claude-opus-4-5", theme: "dark" });
    const plugin = JSON.stringify({
      hooks: { SessionStart: [{ hooks: [{ type: "command", command: "run.js" }] }] },
    });
    const { content } = mergeClaudeSettingsHooks(existing, plugin);
    const result = JSON.parse(content) as Record<string, unknown>;
    expect(result.model).toBe("claude-opus-4-5");
    expect(result.theme).toBe("dark");
    expect(result.hooks).toBeDefined();
  });

  it("additively appends hooks from a second plugin without overwriting", () => {
    const plugin1 = JSON.stringify({
      hooks: { SessionStart: [{ hooks: [{ type: "command", command: "first.js" }] }] },
    });
    const { content: after1 } = mergeClaudeSettingsHooks(null, plugin1);

    const plugin2 = JSON.stringify({
      hooks: { SessionStart: [{ hooks: [{ type: "command", command: "second.js" }] }] },
    });
    const { content: after2 } = mergeClaudeSettingsHooks(after1, plugin2);
    const result = JSON.parse(after2) as { hooks: { SessionStart: unknown[] } };
    expect(result.hooks.SessionStart).toHaveLength(2);
  });

  it("merges two different events independently", () => {
    const plugin = JSON.stringify({
      hooks: {
        SessionStart: [{ hooks: [{ type: "command", command: "start.js" }] }],
        UserPromptSubmit: [{ hooks: [{ type: "command", command: "prompt.js" }] }],
      },
    });
    const { content } = mergeClaudeSettingsHooks(null, plugin);
    const result = JSON.parse(content) as { hooks: Record<string, unknown[]> };
    expect(result.hooks.SessionStart).toHaveLength(1);
    expect(result.hooks.UserPromptSubmit).toHaveLength(1);
  });

  it("returns empty warnings array", () => {
    const plugin = JSON.stringify({ hooks: {} });
    const { warnings } = mergeClaudeSettingsHooks(null, plugin);
    expect(warnings).toEqual([]);
  });

  it("keeps async: true on an entry, so a catch-up never blocks the session start", () => {
    const plugin = JSON.stringify({
      hooks: {
        SessionStart: [
          { hooks: [{ type: "command", command: "catch-up.cjs", async: true, timeout: 120 }] },
        ],
      },
    });
    const { content } = mergeClaudeSettingsHooks(null, plugin);
    const result = JSON.parse(content) as {
      hooks: { SessionStart: { hooks: { async?: boolean; timeout?: number }[] }[] };
    };
    expect(result.hooks.SessionStart[0]?.hooks[0]).toMatchObject({ async: true, timeout: 120 });
  });

  it("keeps async: true on the telemetry plugin's own catch-up entry", () => {
    const shipped = readFileSync(
      join(REPOSITORY_ROOT, "plugins", "aidd-telemetry", "hooks", "hooks.json"),
      "utf8"
    );
    const { content } = mergeClaudeSettingsHooks(null, shipped);
    const result = JSON.parse(content) as {
      hooks: { SessionStart: { hooks: { command: string; async?: boolean }[] }[] };
    };
    const entries = result.hooks.SessionStart.flatMap((group) => group.hooks);
    expect(entries.find((entry) => entry.command.endsWith("catch-up.cjs"))?.async).toBe(true);
    expect(entries.find((entry) => entry.command.endsWith("session-start.cjs"))?.async).not.toBe(
      true
    );
  });

  it("does not create hooks key when plugin has no hook events", () => {
    const plugin = JSON.stringify({ hooks: {} });
    const { content } = mergeClaudeSettingsHooks(null, plugin);
    const result = JSON.parse(content) as Record<string, unknown>;
    expect(result.hooks).toEqual({});
  });
});
