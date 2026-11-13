import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { codexGlobalFilePath } from "../../../../../../src/contexts/tools/domain/profiles/codex/codex-paths.js";
import { globalFilesOf } from "../../../../../../src/contexts/tools/domain/registry.js";

const ORCHESTRATOR = { name: "aidd-orchestrator", agents: new Set<string>() };

describe("codexGlobalFilePath — the agents a machine-scope install copies into ~/.codex", () => {
  it("prefixes a staged agent with its plugin under agents/", () => {
    expect(
      codexGlobalFilePath("plugins/aidd-orchestrator/codex-agents/reviewer.toml", ORCHESTRATOR)
    ).toBe("agents/aidd-orchestrator-reviewer.toml");
  });

  it.each([
    "plugins/aidd-dev/codex-agents/reviewer.toml",
    "plugins/aidd-orchestrator/skills/01-sdlc/SKILL.md",
    "plugins/aidd-orchestrator/codex-agents/nested/reviewer.toml",
    "plugins/aidd-orchestrator/codex-agents/reviewer.md",
  ])("leaves %s out: another plugin's, or not a staged agent", (built) => {
    expect(codexGlobalFilePath(built, ORCHESTRATOR)).toBeNull();
  });
});

describe("the codex profile's machine-scope directory", () => {
  it("is ~/.codex under the home directory", () => {
    expect(globalFilesOf("codex")?.dir("/home/me")).toBe(join("/home/me", ".codex"));
  });
});
