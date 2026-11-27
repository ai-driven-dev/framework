import { describe, expect, it } from "vitest";
import { pluginMaterializerOf } from "../../../../../../src/composition/orchestration/built-placement.js";
import { PluginMaterializer } from "../../../../../../src/contexts/installation/application/plugin/files/plugin-materializer.js";
import { RecordedPlugin } from "../../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../../src/shared/domain/installation-file.js";
import { PluginDistribution } from "../../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../../src/shared/domain/plugin/plugin-name.js";
import { CapturingLogger } from "../../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { fakeBuiltDeps } from "../../../testing/fake-build-sources.fake.js";
import { userScopeFileGuard } from "../../../testing/user-scope-file-guard.fake.js";

const HOME = "/home/dev";
const AGENTS = `${HOME}/.codex/AGENTS.md`;
const RULE = `${HOME}/.codex/instructions/aidd-craft-1-naming.md`;

function file(relativePath: string, content: string): InstallationFile {
  return new InstallationFile({ relativePath, content, hash: FileHash.of(content) });
}

function setup(existingAgents?: string) {
  const fs = new InMemoryFileAdapter(
    existingAgents === undefined ? {} : { [AGENTS]: existingAgents },
    [`${HOME}/.codex`]
  );
  const materializer = pluginMaterializerOf({
    fs,
    loadDistribution: async () => {
      throw new Error("a planned update fetches nothing");
    },
    guard: userScopeFileGuard,
    builtDeps: { ...fakeBuiltDeps(), homedir: () => HOME },
  });
  const plugin = RecordedPlugin.fromMetadata({
    name: "aidd-craft",
    version: "1.0.0",
    source: { kind: "local", path: "/source" },
    strict: false,
    scope: "user",
  });
  const plan = {
    plugin,
    tool: registeredTools().aiProfile(TOOL.codex),
    home: HOME,
    baseDir: `${HOME}/.codex`,
    files: [file("instructions/aidd-craft-1-naming.md", "# Naming\n")],
    oldSafe: new Map<string, string>(),
    next: plugin,
  };
  const request = { logger: new CapturingLogger(), isWithinUserScope: () => true };
  return { fs, materializer, plan, request };
}

describe("applying a machine-scope plugin's files for a tool listing its rules in a guidance file", () => {
  it("writes the rules and lists them in the user's file by their path from the home", async () => {
    const { fs, materializer, plan, request } = setup("# Mine\n");

    await materializer.applyUpdate(plan, request);

    expect(fs.getFile(RULE)).toBe("# Naming\n");
    expect(fs.getFile(AGENTS)).toMatch(/^# Mine\n\n<!-- aidd_plugin_rules:start -->/);
    expect(fs.getFile(AGENTS)).toContain("- `~/.codex/instructions/aidd-craft-*.md`");
  });
});

describe("planning a machine-scope plugin's files for a tool listing its rules in a guidance file", () => {
  it("refuses a user file whose block a person broke before anything is written", async () => {
    const broken = "<!-- aidd_plugin_rules:end -->\n";
    const { fs, plan } = setup(broken);
    const materializer = new PluginMaterializer({
      fs,
      guard: userScopeFileGuard,
      userHome: { dir: () => HOME, platform: process.platform },
      fetchLatest: async () =>
        new PluginDistribution({
          manifest: { name: parsePluginName("aidd-craft"), version: "2.0.0" },
          format: TOOL.claude,
          files: [],
          components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
        }),
      rebuild: async () => ({ files: plan.files, componentPaths: new Map() }),
    });

    await expect(
      materializer.planUpdate({
        plugin: plan.plugin,
        tool: plan.tool,
        projectRoot: "/project",
        logger: new CapturingLogger(),
        isWithinUserScope: () => true,
        rebuild: true,
      })
    ).rejects.toThrow(/repair/);
    expect([fs.has(RULE), fs.getFile(AGENTS)]).toEqual([false, broken]);
  });
});
