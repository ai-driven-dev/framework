import { describe, expect, it } from "vitest";
import { cursor } from "../../../src/composition/tool-profiles/cursor.js";
import { CONFIG_MCP } from "../../../src/contexts/tools/contract/config-refs.js";
import {
  expectClaudeStyleCatalog,
  pluginTreeShapeOf,
  SHIPPED_AS_IS,
} from "../../contexts/tools/testing/profile-tables.builder.js";
import { type InstallKind, installPathOf } from "../../contexts/tools/testing/profiles.builder.js";

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
    expect(mcp?.accepts(".cursor/mcp.json")).toBe(true);
    expect(
      JSON.parse(mcp?.transform(JSON.stringify({ mcpServers: { a: { command: "node" } } })))
    ).toHaveProperty("mcpServers");
    expect(cursor.section("mcp").config?.consumes(CONFIG_MCP)).toBe(true);
  });

  it.each<[InstallKind, string, string | null]>([
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
});

describe("cursor's hooks", () => {
  it("name the plugin root by Cursor's own variable", () => {
    expect(cursor.hooks?.rootToken).toBe("$" + "{CURSOR_PLUGIN_ROOT}");
  });

  it("rewrite a plugin's root token for the project hooks file, leaving a plugin-relative path outside hooks/ where it was", () => {
    const shipped = JSON.stringify({
      hooks: {
        PostToolUse: [
          {
            hooks: [
              { type: "command", command: "node $" + "{CLAUDE_PLUGIN_ROOT}/scripts/run.cjs" },
            ],
          },
        ],
      },
    });
    const format = cursor.projectHooksDelivery()?.format;
    if (format === undefined) throw new Error("no project hooks");

    expect(JSON.parse(format.merge(null, shipped, "plugin-a").content)).toStrictEqual({
      version: 1,
      hooks: { postToolUse: [{ command: "node scripts/run.cjs" }] },
    });
  });
});
