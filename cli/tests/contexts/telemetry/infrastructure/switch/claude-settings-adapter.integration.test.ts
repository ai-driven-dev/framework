import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClaudeSettingsAdapter } from "../../../../../src/contexts/telemetry/infrastructure/switch/claude-settings-adapter.js";

let root: string;
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "aidd-claude-settings-")));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("Claude Code's settings", () => {
  it("are the project's local file, its shared file, then the user's, each null when absent", async () => {
    const project = join(root, "project");
    const user = join(root, "user");
    mkdirSync(join(project, ".claude"), { recursive: true });
    mkdirSync(user);
    const adapter = new ClaudeSettingsAdapter(user);
    expect(await adapter.texts(project)).toEqual([null, null, null]);
    writeFileSync(join(project, ".claude", "settings.local.json"), "local");
    writeFileSync(join(project, ".claude", "settings.json"), "shared");
    writeFileSync(join(user, "settings.json"), "user");
    expect(await adapter.texts(project)).toEqual(["local", "shared", "user"]);
  });
});
