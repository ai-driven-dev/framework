import { describe, expect, it } from "vitest";
import { CONFIG_MCP } from "../../../../../../src/contexts/tools/domain/capabilities/config-refs.js";
import { cursor } from "../../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import {
  expectClaudeStyleCatalog,
  flatPathsOf,
  pluginTreeShapeOf,
  rulesRows,
  SHIPPED_AS_IS,
  WRITES_NOTHING,
} from "../../../testing/profile-tables.js";
import { type InstallKind, installPathOf } from "../../../testing/profiles.js";

describe("cursor declarations the rest of the CLI reads", () => {
  it("has .cursor/ directory", () => {
    expect(cursor.directory).toBe(".cursor/");
  });

  it("probes a marketplace catalog at .cursor-plugin/marketplace.json", () => {
    expect(cursor.distributionProbes?.marketplace).toStrictEqual([
      ".cursor-plugin/marketplace.json",
    ]);
  });

  it("writes agents as markdown", () => {
    expect(cursor.capabilities.agents.params.format).toBe("markdown");
  });

  it("writes its MCP servers as JSON under `mcpServers`, in .cursor/mcp.json", () => {
    expect(cursor.capabilities.mcp.params).toMatchObject({
      outputPath: ".cursor/mcp.json",
      format: "json",
      entrySection: "mcpServers",
    });
    expect(cursor.capabilities.mcp.consumes).toStrictEqual([CONFIG_MCP]);
  });

  it.each<[InstallKind, string, string | null]>([
    ["skills", "commit/SKILL.md", ".cursor/skills/commit/SKILL.md"],
    ["skills", "commit.cursor.md", ".cursor/skills/commit.md"],
    ["agents", "code-reviewer.md", ".cursor/agents/code-reviewer.md"],
    ["commands", "04_code/implement.md", ".cursor/commands/aidd/04/implement.md"],
    ["commands", "commit.md", ".cursor/commands/aidd/commit.md"],
    ["rules", "01-standards/naming.md", ".cursor/rules/01-standards/naming.mdc"],
    ["rules", "01-standards/naming.mdc", ".cursor/rules/01-standards/naming.mdc"],
  ])("installs %s file %s at %s", (kind, built, path) => {
    expect(installPathOf(cursor, kind, built)).toBe(path);
  });
});

describe("cursor build and conversion tables", () => {
  it("places a flat skill and agent under its plugin's name", () => {
    expect(flatPathsOf(cursor)).toStrictEqual({
      skill: ".cursor/skills/aidd-dev-01-plan/SKILL.md",
      renamesSkill: true,
      agent: ".cursor/agents/aidd-dev-planner.md",
      innerMdAgent: ".cursor/agents/aidd-dev-notes.md-helper.md",
    });
  });

  it("ships the plugin tree as it is", () => {
    expect(pluginTreeShapeOf(cursor)).toStrictEqual(SHIPPED_AS_IS);
  });

  it("writes its catalog and entries in Claude's marketplace format", async () => {
    await expectClaudeStyleCatalog(cursor, ".cursor-plugin");
  });

  it.each(
    rulesRows({
      ...WRITES_NOTHING,
      "a paths list": { globs: '["a", "b"]', alwaysApply: false },
      "globs that apply on request": { description: "d", globs: '["a"]', alwaysApply: false },
      "paths beside a description": { description: "d", globs: '["a"]', alwaysApply: false },
      "a description that opts out of always-apply": { description: "d", alwaysApply: false },
    })
  )("converts %s", (_case, frontmatter, expected) => {
    expect(cursor.capabilities.rules.convertFrontmatter(frontmatter)).toStrictEqual(expected);
  });
});
