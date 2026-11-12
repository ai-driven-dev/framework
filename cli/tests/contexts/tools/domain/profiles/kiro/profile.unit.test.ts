import { describe, expect, it } from "vitest";
import { kiro } from "../../../../../../src/contexts/tools/domain/profiles/kiro/profile.js";
import { frameworkBuildModeFor } from "../../../../../../src/contexts/tools/domain/registry.js";

describe("kiro", () => {
  it("is a flat target with no commands and no rules capability", () => {
    expect(frameworkBuildModeFor("kiro")).toBe("flat");
    expect("commands" in kiro.capabilities).toBe(false);
    expect("rules" in kiro.capabilities).toBe(false);
  });

  it("preserves skill metadata", () => {
    const metadata = { name: "plan", description: "Plan work", license: "MIT" };
    expect(kiro.capabilities.skills.convertFrontmatter(metadata)).toEqual(metadata);
  });

  it("is a flat host namespacing each plugin, its skills one level below .kiro/skills", () => {
    expect(kiro.capabilities.plugins).toMatchObject({
      mode: "flat",
      flatNamespacePrefix: "aidd-",
      flatSkillLayout: "single-level",
      acceptsHooks: true,
    });
    expect(Object.keys(kiro.capabilities).sort()).toEqual(["agents", "mcp", "plugins", "skills"]);
  });

  it("keeps a skill's folder and files under .kiro/skills", () => {
    expect(kiro.capabilities.skills.buildInstallPath("01-plan/SKILL.md")).toBe(
      ".kiro/skills/01-plan/SKILL.md"
    );
  });

  it("leaves content as authored: Kiro needs no path rewritten", () => {
    const content = "see @{{TOOLS}}/agents/checker.md and .claude/commands/01_plan/x.md";
    expect(kiro.rewriteContent(content)).toBe(content);
  });

  it("declares no marketplace catalog to probe, having no marketplace of its own", () => {
    expect(kiro.distributionProbes).toBeUndefined();
  });

  it("merges plugin hooks into .kiro/hooks/aidd.json, scripts under .kiro/hooks/", () => {
    expect(kiro.capabilities.plugins).toMatchObject({
      flatHooksDir: ".kiro/hooks/",
      hooksDestination: "project",
      projectHooksRelativePath: ".kiro/hooks/aidd.json",
    });
    expect(kiro.capabilities.plugins.flatHooksBridge).toBeNull();
  });

  it("declares MCP servers as JSON under mcpServers in Kiro's settings file", () => {
    expect(kiro.capabilities.mcp.params).toMatchObject({
      outputPath: ".kiro/settings/mcp.json",
      format: "json",
      entrySection: "mcpServers",
    });
    expect(kiro.capabilities.mcp.consumes).toEqual(["mcp"]);
  });
});
