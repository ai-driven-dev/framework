import { describe, expect, it } from "vitest";
import { codexGlobalFilePath } from "../../../../../../src/contexts/tools/domain/behaviours/codex/codex-paths.model.js";

const ORCHESTRATOR = { name: "aidd-orchestrator", agents: new Set<string>() };

describe("codexGlobalFilePath - the agents a machine-scope install copies into ~/.codex", () => {
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

describe("codexGlobalFilePath - the rules a machine-scope install copies into ~/.codex", () => {
  const CRAFT = { name: "aidd-craft", agents: new Set<string>() };

  it("keeps a plugin's rule under instructions/, named as the flat build names it", () => {
    expect(
      codexGlobalFilePath(
        "plugins/aidd-craft/.codex/instructions/aidd-craft-01-standards-1-naming.md",
        CRAFT
      )
    ).toBe("instructions/aidd-craft-01-standards-1-naming.md");
  });

  it.each([
    "plugins/aidd-dev/.codex/instructions/aidd-dev-1-naming.md",
    "plugins/aidd-craft/.codex/instructions/other-1-naming.md",
    "plugins/aidd-craft/.codex/instructions/nested/aidd-craft-1-naming.md",
    "plugins/aidd-craft/.codex/instructions/aidd-craft-1-naming.txt",
  ])("leaves %s out: another plugin's, or not one of its rules", (built) => {
    expect(codexGlobalFilePath(built, CRAFT)).toBeNull();
  });
});
