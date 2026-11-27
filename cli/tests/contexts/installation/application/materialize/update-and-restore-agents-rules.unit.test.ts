import { describe, expect, it } from "vitest";
import { builtPlacementOf } from "../../../../../src/composition/orchestration/built-placement.js";
import { ReplacePluginFiles } from "../../../../../src/contexts/installation/application/materialize/replace-plugin-files.use-case.js";
import { ApplyPluginFiles } from "../../../../../src/contexts/installation/application/restore/apply-plugin-files.use-case.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../src/shared/domain/plugin/plugin-name.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { fakeBuiltDeps } from "../../testing/fake-build-sources.fake.js";

const ROOT = "/test-project";
const AGENTS = `${ROOT}/AGENTS.md`;
const RULE_PATH = ".codex/instructions/aidd-craft-01-standards-1-naming.md";
const RULE = `${ROOT}/${RULE_PATH}`;
const SOURCE = { kind: "local" as const, path: "/fixture" };
const NEW_RULE = { relativePath: "rules/01-standards/1-naming.md", content: "# Naming v2\n" };

function craft() {
  return new PluginDistribution({
    manifest: { name: parsePluginName("aidd-craft"), version: "2.0.0" },
    format: TOOL.claude,
    files: [NEW_RULE],
    components: { commands: [], agents: [], rules: [NEW_RULE], skills: [], hooks: [], mcp: [] },
  });
}

function installed() {
  const fs = new InMemoryFileAdapter({ [AGENTS]: "# Team\n", [RULE]: "# Naming v1\n" }, [ROOT]);
  const manifest = Manifest.create();
  manifest.addTool(TOOL.codex, "1.0.0", []);
  const plugin = RecordedPlugin.fromMetadata({
    name: "aidd-craft",
    version: "1.0.0",
    source: SOURCE,
    strict: false,
    scope: "project",
    marketplace: "aidd-framework",
  }).withFiles(new Map([[RULE_PATH, "v1-hash"]]));
  manifest.addPlugin(TOOL.codex, plugin);
  return { fs, manifest, plugin, placement: builtPlacementOf(fs, fakeBuiltDeps()) };
}

function expectedAfter(fs: InMemoryFileAdapter, manifest: Manifest) {
  const recorded = manifest.getPlugins(TOOL.codex)[0]?.files.get(RULE_PATH);
  return {
    rule: fs.getFile(RULE),
    rehashed: recorded !== undefined && recorded !== "v1-hash",
    listed: fs.getFile(AGENTS)?.includes("- `.codex/instructions/aidd-craft-*.md`"),
  };
}

const REFRESHED = { rule: "# Naming v2\n", rehashed: true, listed: true };

describe("a Codex project plugin that keeps its rules beside the registration", () => {
  it("writes the new rule, records its digest and keeps it listed when it is updated", async () => {
    const { fs, manifest, plugin, placement } = installed();

    await new ReplacePluginFiles({ fs, ...placement }, registeredTools()).execute({
      plugin,
      dist: craft(),
      toolId: TOOL.codex,
      projectRoot: ROOT,
      manifest,
      machine: Manifest.create(),
    });

    expect(expectedAfter(fs, manifest)).toEqual(REFRESHED);
  });

  it("writes the new rule, records its digest and keeps it listed when it is restored", async () => {
    const { fs, manifest, plugin, placement } = installed();

    await new ApplyPluginFiles({
      fs,
      loadDistribution: async () => craft(),
      ...placement,
    }).execute({
      toolId: TOOL.codex,
      plugin,
      tool: registeredTools().aiProfile(TOOL.codex),
      projectRoot: ROOT,
      cacheDir: "/cache",
      manifest,
      machine: Manifest.create(),
      fileFilter: null,
    });

    expect(expectedAfter(fs, manifest)).toEqual(REFRESHED);
  });
});
