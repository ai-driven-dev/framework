import { describe, expect, it } from "vitest";
import { CONFIG_MCP } from "../../../../../../src/contexts/tools/domain/capabilities/config-refs.js";
import { copilot } from "../../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import { nativeActivationOf } from "../../../../../../src/contexts/tools/domain/registry.js";
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
    expect(copilot.capabilities.agents.params.format).toBe("markdown");
  });

  it("writes its MCP servers as JSON under `servers`", () => {
    expect(copilot.capabilities.mcp.params).toMatchObject({
      format: "json",
      entrySection: "servers",
    });
    expect(copilot.capabilities.mcp.consumes).toStrictEqual([CONFIG_MCP]);
  });

  it("translates plugins for its own marketplace", () => {
    expect(copilot.capabilities.plugins.translationMode).toBe("marketplace");
  });

  it("drives its own CLI with the verbs it answers to", () => {
    expect(nativeActivationOf("copilot")).toMatchObject({
      binary: "copilot",
      upgradeVerb: "update",
      updateVerb: "update",
      enableVerb: "install",
      disableVerb: "uninstall",
      sourceCheckVerb: "update",
      forceRemoveArgs: ["--force"],
      uninstallLeavesRefDisabled: true,
    });
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
    const settings = Array.isArray(copilot.capabilities.settings)
      ? copilot.capabilities.settings[0]
      : copilot.capabilities.settings;
    expect(settings.params.outputPath).toBe(".vscode/settings.json");
    expect(settings.getMergeStrategy()).toBe("framework-prime");
    expect(settings.staticContentAssetFile).toBe("vscode-settings.json");
    expect(settings.staticContent).toBeUndefined();
    expect(settings.consumes).toHaveLength(0);
    expect(settings.requiresTool).toBe("vscode");
  });
});
