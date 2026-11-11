import { describe, expect, it } from "vitest";
import { codex } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { ToolCatalog } from "../../../../../../src/contexts/tools/domain/registry.js";
import { PLUGIN_TREE_SOURCES, supported } from "../../../testing/build-artifacts.js";
import { contractOf, flatPathsOf, marketplaceSourcesOf } from "../../../testing/profile-tables.js";
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

describe("codex build and conversion tables", () => {
  it("places a flat skill and agent under its plugin's name", () => {
    expect(flatPathsOf(codex)).toStrictEqual({
      skill: ".agents/skills/aidd-dev-01-plan/SKILL.md",
      renamesSkill: true,
      agent: ".codex/agents/aidd-dev-planner.toml",
      innerMdAgent: ".codex/agents/aidd-dev-notes.md-helper.toml",
    });
  });

  it("sources the plugin tree as it ships, and stages an agent named with an inner .md as .toml", () => {
    expect(marketplaceSourcesOf(codex)).toStrictEqual(PLUGIN_TREE_SOURCES);
    expect(
      supported(contractOf(codex, "marketplace").artifacts.agents).path(
        "aidd-dev",
        "agents/notes.md-helper.md"
      )
    ).toBe("codex-agents/notes.md-helper.toml");
  });
});

describe("codex as the registry answers for it", () => {
  it("enables plugins machine-wide", () => {
    expect(new ToolCatalog([codex]).pluginEnablementIsMachineGlobal("codex")).toBe(true);
  });

  it("installs its rules into .codex/rules/ as markdown", () => {
    expect(codex.section("rules").installedLocation()).toEqual({
      directory: ".codex/rules/",
      extension: ".md",
    });
  });
});
