import { describe, expect, it } from "vitest";
import { codex } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { type InstallKind, installPathOf } from "../../../testing/profiles.js";

describe("codex profile", () => {
  it("declares its directory, tool suffix, signal directory and the one config file it reads", () => {
    expect(codex.directory).toBe(".codex/");
    expect(codex.toolSuffix).toBe(".codex.md");
    expect(codex.signalDir).toBe(".codex/commands");
    expect(codex.configOutputPaths).toStrictEqual({ "config.toml": ".codex/config.toml" });
  });

  it.each<[InstallKind, string, string]>([
    ["skills", "my-skill/SKILL.md", ".agents/skills/aidd-my-skill/SKILL.md"],
    ["skills", "my-skill.codex.md", ".agents/skills/aidd-my-skill/SKILL.md"],
    ["skills", "my-skill.md", ".agents/skills/aidd-my-skill/SKILL.md"],
    ["skills", "my-skill", ".agents/skills/aidd-my-skill/SKILL.md"],
    ["skills", "notes.md/SKILL.md", ".agents/skills/aidd-notes.md/SKILL.md"],
    ["agents", "alexia.md", ".codex/agents/alexia.toml"],
    ["rules", "01-standards/naming.md", ".codex/rules/01-standards/naming.md"],
    ["rules", "01-standards/naming.codex.md", ".codex/rules/01-standards/naming.md"],
    ["commands", "04_code/implement.md", ".codex/commands/aidd/04/implement.md"],
    ["commands", "commit.md", ".codex/commands/aidd/commit.md"],
  ])("installs %s file %s at %s", (kind, built, path) => {
    expect(installPathOf(codex, kind, built)).toBe(path);
  });
});
