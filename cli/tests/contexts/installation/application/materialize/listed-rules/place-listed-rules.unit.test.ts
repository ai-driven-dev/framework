import { describe, expect, it } from "vitest";
import { toolPlacementOf } from "../../../../../../src/contexts/installation/application/plugin/add/place-plugin.use-case.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { PluginDistribution } from "../../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../../src/shared/domain/plugin/plugin-name.js";
import type { PluginSource } from "../../../../../../src/shared/domain/plugin/source.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { fakeBuiltDeps } from "../../../testing/fake-build-sources.fake.js";

const ROOT = "/test-project";
const AGENTS = `${ROOT}/AGENTS.md`;
const RULE = `${ROOT}/.codex/instructions/aidd-craft-01-standards-1-naming.md`;
const LOCAL: PluginSource = { kind: "local", path: "/fixture" };
const RULE_FILE = { relativePath: "rules/01-standards/1-naming.md", content: "# Naming\n" };

function craft() {
  return new PluginDistribution({
    manifest: { name: parsePluginName("aidd-craft"), version: "1.0.0" },
    format: TOOL.claude,
    files: [RULE_FILE],
    components: { commands: [], agents: [], rules: [RULE_FILE], skills: [], hooks: [], mcp: [] },
  });
}

async function placeOnCodex(fs: InMemoryFileAdapter, source: PluginSource = LOCAL) {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.codex, "1.0.0", []);
  const placeForTool = toolPlacementOf({
    fs,
    translate: fakeBuiltDeps().translate,
    placeBuiltTree: async () => ({ skipped: [] }),
  });
  await placeForTool({
    command: {
      dist: craft(),
      toolIds: [TOOL.codex],
      source,
      projectRoot: ROOT,
      manifest,
      machine: Manifest.create(),
      marketplace: "aidd-framework",
      previousMcpEntries: new Map(),
      previousProjectHooks: new Map(),
      previousFiles: new Map(),
    },
    tool: registeredTools().aiProfile(TOOL.codex),
    userScopeDirTaken: false,
  });
  return manifest;
}

describe("placing a plugin's rules for a tool whose native install carries none", () => {
  it("places them in the project, lists them in AGENTS.md after the team's text, and records them", async () => {
    const fs = new InMemoryFileAdapter({ [AGENTS]: "# Team\n" }, [ROOT]);

    const manifest = await placeOnCodex(fs);

    expect(fs.getFile(RULE)).toBe("# Naming\n");
    expect(fs.getFile(AGENTS)).toMatch(/^# Team\n\n<!-- aidd_plugin_rules:start -->/);
    expect(fs.getFile(AGENTS)).toContain("- `.codex/instructions/aidd-craft-*.md`");
    expect([...(manifest.getPlugins(TOOL.codex)[0]?.files.keys() ?? [])]).toEqual([
      ".codex/instructions/aidd-craft-01-standards-1-naming.md",
    ]);
  });

  it("refuses a block whose markers do not pair before it writes a rule or records the plugin", async () => {
    const broken = "<!-- aidd_plugin_rules:start -->\nhand edit\n";
    const fs = new InMemoryFileAdapter({ [AGENTS]: broken }, [ROOT]);

    await expect(placeOnCodex(fs)).rejects.toThrow(/repair/);

    expect([fs.has(RULE), fs.getFile(AGENTS)]).toEqual([false, broken]);
  });

  it("lists them as well when the plugin comes from a source that is not a local path", async () => {
    const fs = new InMemoryFileAdapter({ [AGENTS]: "# Team\n" }, [ROOT]);

    await placeOnCodex(fs, { kind: "github", repo: "ai-driven-dev/framework" });

    expect([fs.has(RULE), fs.getFile(AGENTS)]).toEqual([
      true,
      expect.stringContaining("- `.codex/instructions/aidd-craft-*.md`"),
    ]);
  });

  it("refuses a broken block before it writes a rule from a source that is not a local path", async () => {
    const broken = "<!-- aidd_plugin_rules:start -->\nhand edit\n";
    const fs = new InMemoryFileAdapter({ [AGENTS]: broken }, [ROOT]);

    await expect(
      placeOnCodex(fs, { kind: "github", repo: "ai-driven-dev/framework" })
    ).rejects.toThrow(/repair/);

    expect(fs.has(RULE)).toBe(false);
  });
});
