import { describe, expect, it } from "vitest";
import { CONFIG_MCP } from "../../../../../../src/contexts/tools/contract/config-refs.js";
import { cursor } from "../../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import {
  expectClaudeStyleCatalog,
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
    expect(cursor.distributionPaths("marketplace")).toStrictEqual([
      ".cursor-plugin/marketplace.json",
    ]);
  });

  it("writes agents as markdown", () => {
    expect(cursor.section("agents").serialize({ name: "a" }, "body")).toMatch(/^---\n/);
  });

  it("writes its MCP servers as JSON under `mcpServers`, in .cursor/mcp.json", () => {
    const mcp = cursor.section("mcp").config;
    expect(mcp?.outputPath()).toBe(".cursor/mcp.json");
    expect(
      JSON.parse(mcp?.transform(JSON.stringify({ mcpServers: { a: { command: "node" } } })))
    ).toHaveProperty("mcpServers");
    expect(cursor.section("mcp").config?.consumes(CONFIG_MCP)).toBe(true);
  });

  it.each<[InstallKind, string, string | null]>([
    ["skills", "commit.cursor.md", ".cursor/skills/commit.md"],
    ["commands", "04_code/implement.md", ".cursor/commands/aidd/04/implement.md"],
    ["rules", "01-standards/naming.md", ".cursor/rules/01-standards/naming.mdc"],
  ])("installs %s file %s at %s", (kind, built, path) => {
    expect(installPathOf(cursor, kind, built)).toBe(path);
  });
});

describe("cursor build and conversion tables", () => {
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
    expect(cursor.section("rules").convertFrontmatter(frontmatter)).toStrictEqual(expected);
  });
});
