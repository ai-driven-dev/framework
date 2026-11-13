import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import { ToolCatalog } from "../../../../../../src/contexts/tools/domain/registry.js";
import {
  expectClaudeStyleCatalog,
  flatPathsOf,
  pluginTreeShapeOf,
  rulesRows,
  SHIPPED_AS_IS,
  WRITES_NOTHING,
} from "../../../testing/profile-tables.js";
import { type InstallKind, installPathOf } from "../../../testing/profiles.js";

describe("claude profile", () => {
  it("lives in .claude/ and writes its one config file to .claude/settings.json", () => {
    expect(claude.directory).toBe(".claude/");
    expect(claude.configOutputPaths).toStrictEqual({ "settings.json": ".claude/settings.json" });
  });

  it.each<[InstallKind, string, string]>([
    ["skills", "commit.claude.md", ".claude/skills/commit.md"],
    ["agents", "code-reviewer.md", ".claude/agents/code-reviewer.md"],
    ["rules", "01-standards/naming.md", ".claude/rules/01-standards/naming.md"],
    ["commands", "04_code/implement.md", ".claude/commands/aidd/04/implement.md"],
    [
      "commands",
      "02_context/create_user_stories.md",
      ".claude/commands/aidd/02/create_user_stories.md",
    ],
    ["commands", "4/implement.md", ".claude/commands/aidd/4/implement.md"],
    ["commands", "01-notes.md", ".claude/commands/01-notes.md"],
    ["commands", "v04/notes.md", ".claude/commands/v04/notes.md"],
  ])("installs %s file %s at %s", (kind, built, path) => {
    expect(installPathOf(claude, kind, built)).toBe(path);
  });
});

describe("claude build and conversion tables", () => {
  it("places a flat skill and agent under its plugin's name", () => {
    expect(flatPathsOf(claude)).toStrictEqual({
      skill: ".claude/skills/aidd-dev-01-plan/SKILL.md",
      renamesSkill: true,
      agent: ".claude/agents/aidd-dev-planner.md",
      innerMdAgent: ".claude/agents/aidd-dev-notes.md-helper.md",
    });
  });

  it("ships the plugin tree as it is", () => {
    expect(pluginTreeShapeOf(claude)).toStrictEqual(SHIPPED_AS_IS);
  });

  it("writes its catalog and entries in Claude's marketplace format", async () => {
    await expectClaudeStyleCatalog(claude, ".claude-plugin");
  });

  it.each(
    rulesRows({
      ...WRITES_NOTHING,
      "a paths list": { paths: ["a", "b"] },
      "globs that apply on request": { paths: ["a"] },
      "paths beside a description": { paths: ["a"] },
      "a description that opts out of always-apply": { description: "d" },
    })
  )("converts %s", (_case, frontmatter, expected) => {
    expect(claude.capabilities.rules.convertFrontmatter(frontmatter)).toStrictEqual(expected);
  });
});

describe("claude as the registry answers for it", () => {
  const catalog = new ToolCatalog([claude]);

  it("builds a marketplace and keeps its settings.local.json out of tracking", () => {
    expect(catalog.frameworkBuildModeFor("claude")).toBe("marketplace");
    expect(catalog.machineLocalFilesOf("claude")).toEqual([".claude/settings.local.json"]);
  });

  it("names its user settings file under the home directory", () => {
    expect(catalog.userMachineLocalFilesOf("claude", "/home/tester", () => undefined)).toEqual([
      join("/home/tester", ".claude", "settings.json"),
    ]);
  });

  it("merges no hooks into the project, enables plugins per project and keeps a disabled host ref", () => {
    expect(catalog.projectHooksFileOf("claude")).toBeUndefined();
    expect(catalog.pluginEnablementIsMachineGlobal("claude")).toBe(false);
    expect(catalog.hostRefInUse("claude", false)).toBe(true);
  });

  it("installs its rules into .claude/rules/ as markdown", () => {
    expect(claude.capabilities.rules.installedLocation()).toEqual({
      directory: ".claude/rules/",
      extension: ".md",
    });
  });
});
