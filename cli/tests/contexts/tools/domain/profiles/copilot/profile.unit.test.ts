import { describe, expect, it } from "vitest";
import { CONFIG_MCP } from "../../../../../../src/contexts/tools/domain/capabilities/config-refs.js";
import { copilot } from "../../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import {
  nativeActivationOf,
  ToolCatalog,
} from "../../../../../../src/contexts/tools/domain/registry.js";
import { nativeOf } from "../../../testing/plugin-mode.js";
import {
  flatPathsOf,
  pluginTreeShapeOf,
  rulesRows,
  SHIPPED_AS_IS,
  WRITES_NOTHING,
} from "../../../testing/profile-tables.js";
import { type InstallKind, installPathOf } from "../../../testing/profiles.js";

describe("copilot declarations the rest of the CLI reads", () => {
  it("probes a plugin manifest in the three places Copilot reads one, in its order", () => {
    expect(copilot.distributionProbes?.manifest).toStrictEqual([
      ".plugin/plugin.json",
      ".github/plugin/plugin.json",
      "plugin.json",
    ]);
  });

  it("writes agents as markdown", () => {
    expect(copilot.section("agents").serialize({ name: "a" }, "body")).toMatch(/^---\n/);
  });

  it("writes its MCP servers as JSON under `servers`", () => {
    const written = copilot
      .section("mcp")
      .transform(JSON.stringify({ mcpServers: { a: { command: "node" } } }));
    expect(() => JSON.parse(written)).not.toThrow();
    expect(copilot.section("mcp").consumes(CONFIG_MCP)).toBe(true);
  });

  it("translates plugins for its own marketplace", () => {
    expect(nativeOf(copilot.section("plugins")).translatesAsMarketplace()).toBe(true);
  });

  it("drives its own CLI with the verbs it answers to", () => {
    const activation = nativeActivationOf("copilot");
    expect(activation?.hostBinary()).toBe("copilot");
    expect(activation?.cliShape()).toMatchObject({
      upgradeVerb: "update",
      updateVerb: "update",
      enableVerb: "install",
      disableVerb: "uninstall",
      sourceCheckVerb: "update",
      forceRemoveArgs: ["--force"],
    });
    expect(activation?.takesRefForInUse(false)).toBe(false);
  });

  it.each<[InstallKind, string, string | null]>([
    ["skills", "commit/SKILL.md", ".github/skills/commit/SKILL.md"],
    ["agents", "code-reviewer.md", ".github/agents/code-reviewer.agent.md"],
    ["agents", ".gitkeep", null],
    ["agents", "team/sub/code-reviewer.md", ".github/agents/code-reviewer.agent.md"],
    ["agents", "helper.txt", ".github/agents/helper.txt"],
    ["commands", "04_code/implement.md", ".github/prompts/04-implement.prompt.md"],
    ["commands", "00_behavior/auto_accept.md", ".github/prompts/00-auto-accept.prompt.md"],
    ["commands", "commit.md", ".github/prompts/commit.prompt.md"],
    ["commands", "01_plan/02_steps/review.md", ".github/prompts/01-02-review.prompt.md"],
    ["commands", "v2-tools/x.md", ".github/prompts/v2-tools-x.prompt.md"],
    ["commands", "review.prompt.md", ".github/prompts/review.prompt.md"],
    ["commands", "commit", ".github/prompts/commit.prompt.md"],
    ["rules", "01-standards/1-mermaid.md", ".github/instructions/01-mermaid.instructions.md"],
    ["rules", "01-standards/naming.md", ".github/instructions/01-naming.instructions.md"],
    ["rules", "01-standards/10-mermaid.md", ".github/instructions/01-mermaid.instructions.md"],
    [
      "rules",
      "01-standards/naming-2-rules.md",
      ".github/instructions/01-naming-2-rules.instructions.md",
    ],
    [
      "rules",
      "04-tooling/ide-mapping.copilot.md",
      ".github/instructions/04-ide-mapping.instructions.md",
    ],
    ["rules", "00-architecture/.gitkeep", null],
  ])("installs %s file %s at %s", (kind, built, path) => {
    expect(installPathOf(copilot, kind, built)).toBe(path);
  });

  it("writes .vscode/settings.json from the CLI's own asset, gated on VS Code being present", () => {
    const declared = copilot.section("settings");
    const settings = Array.isArray(declared) ? declared[0] : declared;
    expect(settings.outputPath()).toBe(".vscode/settings.json");
    expect(settings.mergeStrategy()).toBe("framework-prime");
    const loaded: string[] = [];
    expect(
      settings.resolveStaticContent((name) => {
        loaded.push(name);
        return "{}";
      })
    ).toBe("{}");
    expect(loaded).toStrictEqual(["vscode-settings.json"]);
    expect(settings.requiredTool()).toBe("vscode");
  });
});

describe("copilot build and conversion tables", () => {
  it("places a flat skill and agent under its plugin's name", () => {
    expect(flatPathsOf(copilot)).toStrictEqual({
      skill: ".github/skills/aidd-dev-01-plan/SKILL.md",
      renamesSkill: true,
      agent: ".github/agents/aidd-dev-planner.agent.md",
      innerMdAgent: ".github/agents/aidd-dev-notes.md-helper.agent.md",
    });
  });

  it("ships the plugin tree as it is", () => {
    expect(pluginTreeShapeOf(copilot)).toStrictEqual(SHIPPED_AS_IS);
  });

  it.each(
    rulesRows({
      ...WRITES_NOTHING,
      "a paths list": { applyTo: "a,b" },
      "globs that apply on request": { applyTo: "a" },
      "paths beside a description": { applyTo: "a" },
      "a description that opts out of always-apply": { description: "d" },
    })
  )("converts %s", (_case, frontmatter, expected) => {
    expect(copilot.section("rules").convertFrontmatter(frontmatter)).toStrictEqual(expected);
  });
});

describe("copilot as the registry answers for it", () => {
  const catalog = new ToolCatalog([copilot]);

  it("enables plugins machine-wide and takes a disabled host ref for none in use", () => {
    expect(catalog.pluginEnablementIsMachineGlobal("copilot")).toBe(true);
    expect(catalog.hostRefInUse("copilot", false)).toBe(false);
    expect(catalog.hostRefInUse("copilot", true)).toBe(true);
  });

  it("installs its rules into .github/instructions/ as .instructions.md", () => {
    expect(copilot.section("rules").installedLocation()).toEqual({
      directory: ".github/instructions/",
      extension: ".instructions.md",
    });
  });
});
