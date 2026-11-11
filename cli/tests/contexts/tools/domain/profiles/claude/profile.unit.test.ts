import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
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
