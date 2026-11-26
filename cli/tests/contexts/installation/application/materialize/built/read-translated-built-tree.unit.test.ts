import { describe, expect, it } from "vitest";
import { readTranslatedBuiltTree } from "../../../../../../src/contexts/installation/application/materialize/built/read-translated-built-tree.js";
import type { BuiltMaterializationDeps } from "../../../../../../src/contexts/installation/application/plugin/files/built-materialization-deps.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { PluginDistribution } from "../../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../../src/shared/domain/plugin/plugin-name.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { projectIntegrationOver } from "../../../../../shared/testing/project-integration.builder.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { fakeBuiltDeps, translateDistribution } from "../../../testing/fake-build-sources.fake.js";
import { FakeMarketplaceRegistry } from "../../../testing/fake-marketplace-registry.fake.js";

async function readBuilt(
  fs: InMemoryFileAdapter,
  translate: BuiltMaterializationDeps["translate"] = translateDistribution,
  at: {
    tool: typeof TOOL.cursor | typeof TOOL.kilo | typeof TOOL.kimi;
    mode: "marketplace" | "flat";
  } = {
    tool: TOOL.cursor,
    mode: "marketplace",
  }
) {
  const manifest = Manifest.create();
  manifest.addTool(at.tool, "test", []);
  return readTranslatedBuiltTree(
    {
      dist: new PluginDistribution({
        manifest: { name: parsePluginName("sample-plugin"), version: "1.0.0" },
        format: TOOL.claude,
        files: [],
        components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
      }),
      tool: registeredTools().aiProfile(at.tool),
      source: { kind: "local", path: "/source" },
      projectRoot: "/proj",
      manifest,
      marketplace: "aidd-framework",
    },
    {
      deps: {
        fs,
        ...fakeBuiltDeps({
          homedir: () => "/home/u",
          marketplaceRegistry: new FakeMarketplaceRegistry(),
          translate,
        }),
        projectHooks: projectIntegrationOver(fs).materializer,
      },
      marketplace: {
        name: "aidd-framework",
        source: { kind: "local", path: "/src" },
        scope: "project",
      },
      mode: at.mode,
    }
  );
}

describe("reading a translated built tree", () => {
  it("reads the built plugin tree and reports no mcp entry for a plugin declaring none", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile("/built/cursor/plugins/sample-plugin/skills/demo/SKILL.md", "built skill");

    const { files, mcp } = await readBuilt(fs);

    expect(files.map((f) => f.relativePath)).toStrictEqual(["sample-plugin/skills/demo/SKILL.md"]);
    expect(mcp.mcpEntries.size).toBe(0);
  });

  it("leaves out a built file the translation says the tool drops", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile("/built/cursor/plugins/sample-plugin/skills/demo/SKILL.md", "built skill");
    fs.setFile("/built/cursor/plugins/sample-plugin/skills/demo/extra.md", "dropped");
    const translate: BuiltMaterializationDeps["translate"] = {
      execute: (command) => ({
        ...translateDistribution.execute(command),
        dropsBuiltFile: (path) => path.endsWith("extra.md"),
      }),
    };

    const { files } = await readBuilt(fs, translate);

    expect(files.map((f) => f.relativePath)).toStrictEqual(["sample-plugin/skills/demo/SKILL.md"]);
  });
});

describe("reading a flat built tree of a tool that lists its rules in its config", () => {
  const BUILT_RULE = "/built/kilo/.kilo/rules/sample-plugin-01-standards-naming.md";
  const at = { tool: TOOL.kilo, mode: "flat" } as const;

  it("keeps the plugin's rules among its files and lists them in the project's config", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(BUILT_RULE, "# Naming\n");
    fs.setFile("/built/kilo/.kilo/rules/other-plugin-a.md", "# Other\n");

    const { files } = await readBuilt(fs, translateDistribution, at);

    expect(files.map((f) => f.relativePath)).toStrictEqual([
      ".kilo/rules/sample-plugin-01-standards-naming.md",
    ]);
    expect(JSON.parse(fs.getFile("/proj/.kilo/kilo.jsonc") ?? "null")).toEqual({
      instructions: [".kilo/rules/sample-plugin-*.md"],
    });
  });

  it("lists no rules when the built tree holds none of the plugin's", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile("/built/kilo/.kilo/skills/sample-plugin/demo/SKILL.md", "skill");

    await readBuilt(fs, translateDistribution, at);

    expect(fs.has("/proj/.kilo/kilo.jsonc")).toBe(false);
  });
});

describe("reading a flat built tree of a tool that lists its rules in AGENTS.md", () => {
  const BUILT_RULE = "/built/kimi/.kimi-code/instructions/sample-plugin-01-standards-naming.md";
  const GLOB = ".kimi-code/instructions/sample-plugin-*.md";
  const at = { tool: TOOL.kimi, mode: "flat" } as const;

  it("lists the plugin's rules after the team's text, which the build's own file never replaces", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(BUILT_RULE, "# Naming\n");
    fs.setFile("/built/kimi/AGENTS.md", "# From the build\n");
    fs.setFile("/proj/AGENTS.md", "# Team notes\n");

    const { files } = await readBuilt(fs, translateDistribution, at);

    expect(files.map((f) => f.relativePath)).toStrictEqual([
      ".kimi-code/instructions/sample-plugin-01-standards-naming.md",
    ]);
    const agents = fs.getFile("/proj/AGENTS.md") ?? "";
    expect(agents.startsWith("# Team notes\n\n<!-- aidd_plugin_rules:start -->")).toBe(true);
    expect(agents).toContain(`- \`${GLOB}\``);
    expect(agents).not.toContain("From the build");
  });

  it("refuses a block of the team's AGENTS.md whose markers do not pair, before placing anything", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(BUILT_RULE, "# Naming\n");
    fs.setFile("/proj/AGENTS.md", "<!-- aidd_plugin_rules:start -->\nhand edit\n");

    await expect(readBuilt(fs, translateDistribution, at)).rejects.toThrow(/AGENTS\.md.*repair/);
  });
});
