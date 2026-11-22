import { describe, expect, it } from "vitest";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { fakeEnsureBuiltMarketplace } from "../../../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { builtTreeTranslator } from "../../testing/built-translators.builder.js";
import { translateDistribution } from "../../testing/fake-build-sources.fake.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.fake.js";

const PROJECT_ROOT = "/proj";
const BUILT = "/built/opencode";
const KILO_BUILT = "/built/kilo";

function dist(): PluginDistribution {
  return new PluginDistribution({
    manifest: { name: "aidd-vcs", version: "1.0.0" },
    format: TOOL.claude,
    files: [],
    components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
  });
}

function distWithHooks(): PluginDistribution {
  return new PluginDistribution({
    manifest: { name: "aidd-vcs", version: "1.0.0" },
    format: TOOL.claude,
    files: [],
    components: {
      commands: [],
      agents: [],
      rules: [],
      skills: [],
      mcp: [],
      hooks: [
        { relativePath: "hooks/hooks.json", content: "{}" },
        { relativePath: "hooks/journal.cjs", content: "// journal" },
        { relativePath: "hooks/lib/host.cjs", content: "// host" },
        { relativePath: "hooks/opencode-plugin.js", content: "export const plugin = 1;" },
      ],
    },
  });
}

async function makeRegistry(): Promise<FakeMarketplaceRegistry> {
  const registry = new FakeMarketplaceRegistry();
  registry.seed(PROJECT_ROOT, {
    name: "aidd-framework",
    source: { kind: "local", path: "/src/framework" },
    scope: "project",
  });
  return registry;
}

describe("BuiltTreeMaterializationTranslator - opencode (integration)", () => {
  it("copies only this plugin's flat files into the project, byte-for-byte", async () => {
    const fs = new InMemoryFileAdapter();
    const skill = "Load [assets/x.md](../assets/x.md)";
    // This plugin's skills nest under its own segment (aidd-vcs/...); agents stay
    // hyphen-prefixed (aidd-vcs-helper.md). Another plugin's files must be ignored.
    fs.setFile(`${BUILT}/.opencode/skills/aidd-vcs/01-commit/SKILL.md`, skill);
    fs.setFile(`${BUILT}/.opencode/agents/aidd-vcs-helper.md`, "agent body");
    fs.setFile(`${BUILT}/.opencode/skills/aidd-dev/00-sdlc/SKILL.md`, "OTHER PLUGIN");
    fs.setFile(`${BUILT}/.build-version`, "5.0.0:1.0.0");

    const manifest = Manifest.create();
    manifest.addTool(TOOL.opencode, "test", []);
    const translator = builtTreeTranslator(fs, {
      platform: process.platform,
      homedir: () => "/home/u",
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      marketplaceRegistry: await makeRegistry(),
      translate: translateDistribution,
    });

    await translator.addPlugin({
      dist: dist(),
      tool: registeredTools().aiProfile(TOOL.opencode),
      source: { kind: "local", path: "/plugin-source" },
      projectRoot: PROJECT_ROOT,
      manifest,
      marketplace: "aidd-framework",
    });

    expect(fs.getFile(`${PROJECT_ROOT}/.opencode/skills/aidd-vcs/01-commit/SKILL.md`)).toBe(skill);
    expect(fs.getFile(`${PROJECT_ROOT}/.opencode/agents/aidd-vcs-helper.md`)).toBe("agent body");
    expect(fs.has(`${PROJECT_ROOT}/.opencode/skills/aidd-dev/00-sdlc/SKILL.md`)).toBe(false);
    expect(fs.has(`${PROJECT_ROOT}/.build-version`)).toBe(false);
    const installed = manifest.getPlugins(TOOL.opencode).find((p) => p.name === "aidd-vcs");
    expect(installed?.files.size).toBe(2);
  });

  // Hook paths follow none of the "<plugin>-" naming `belongsToPlugin` reads, so they are
  // computed from the plugin's own distribution and matched by path.
  it("copies this plugin's flat hooks by their computed paths, not by naming convention", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(`${BUILT}/.opencode/hooks/aidd-vcs/journal.cjs`, "// journal");
    fs.setFile(`${BUILT}/.opencode/hooks/aidd-vcs/lib/host.cjs`, "// host");
    fs.setFile(`${BUILT}/.opencode/plugin/aidd-vcs.js`, "export const plugin = 1;");
    fs.setFile(`${BUILT}/.opencode/hooks/other-plugin/hook.js`, "OTHER PLUGIN");
    fs.setFile(`${BUILT}/.opencode/plugin/other-plugin.js`, "OTHER PLUGIN");

    const manifest = Manifest.create();
    manifest.addTool(TOOL.opencode, "test", []);
    const translator = builtTreeTranslator(fs, {
      platform: process.platform,
      homedir: () => "/home/u",
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      marketplaceRegistry: await makeRegistry(),
      translate: translateDistribution,
    });

    await translator.addPlugin({
      dist: distWithHooks(),
      tool: registeredTools().aiProfile(TOOL.opencode),
      source: { kind: "local", path: "/plugin-source" },
      projectRoot: PROJECT_ROOT,
      manifest,
      marketplace: "aidd-framework",
    });

    expect(fs.getFile(`${PROJECT_ROOT}/.opencode/hooks/aidd-vcs/journal.cjs`)).toBe("// journal");
    expect(fs.getFile(`${PROJECT_ROOT}/.opencode/hooks/aidd-vcs/lib/host.cjs`)).toBe("// host");
    expect(fs.getFile(`${PROJECT_ROOT}/.opencode/plugin/aidd-vcs.js`)).toBe(
      "export const plugin = 1;"
    );
    expect(fs.has(`${PROJECT_ROOT}/.opencode/hooks/aidd-vcs/hooks.json`)).toBe(false);
    expect(fs.has(`${PROJECT_ROOT}/.opencode/hooks/other-plugin/hook.js`)).toBe(false);
    expect(fs.has(`${PROJECT_ROOT}/.opencode/plugin/other-plugin.js`)).toBe(false);
  });
});

describe("BuiltTreeMaterializationTranslator - what the opencode flat tree never yields", () => {
  async function installFrom(
    fs: InMemoryFileAdapter,
    distribution: PluginDistribution
  ): Promise<{ skipped: readonly unknown[] }> {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.opencode, "test", []);
    const translator = builtTreeTranslator(fs, {
      platform: process.platform,
      homedir: () => "/home/u",
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      marketplaceRegistry: await makeRegistry(),
      translate: translateDistribution,
    });
    return translator.addPlugin({
      dist: distribution,
      tool: registeredTools().aiProfile(TOOL.opencode),
      source: { kind: "local", path: "/plugin-source" },
      projectRoot: PROJECT_ROOT,
      manifest,
      marketplace: "aidd-framework",
    });
  }

  it("reports no skip for a tool that keeps hooks inside its own plugin tree", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(`${BUILT}/.opencode/agents/aidd-vcs-helper.md`, "agent body");

    const result = await installFrom(fs, dist());

    expect(result.skipped).toStrictEqual([]);
  });

  it("ignores built files outside .opencode and entries sitting directly under it", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(`${BUILT}/other/agents/aidd-vcs-helper.md`, "not opencode");
    fs.setFile(`${BUILT}/.opencode/aidd-vcs-readme.md`, "too shallow");
    fs.setFile(`${BUILT}/.opencode/agents/aidd-vcs-helper.md`, "agent body");

    await installFrom(fs, dist());

    expect(fs.listUnder(PROJECT_ROOT)).toStrictEqual([
      `${PROJECT_ROOT}/.opencode/agents/aidd-vcs-helper.md`,
    ]);
  });

  it("never copies the plugin's own hooks manifest, even when the built tree carries one", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(`${BUILT}/.opencode/hooks/aidd-vcs/hooks.json`, "{}");
    fs.setFile(`${BUILT}/.opencode/hooks/aidd-vcs/journal.cjs`, "// journal");

    await installFrom(fs, distWithHooks());

    expect(fs.listUnder(PROJECT_ROOT)).toStrictEqual([
      `${PROJECT_ROOT}/.opencode/hooks/aidd-vcs/journal.cjs`,
    ]);
  });
});

describe("BuiltTreeMaterializationTranslator - kilo (integration)", () => {
  it("copies Kilo's namespaced flat files and the generated bridge", async () => {
    const fs = new InMemoryFileAdapter();
    const configPath = `${PROJECT_ROOT}/.kilo/kilo.jsonc`;
    const baseConfig = '{\n  "$schema": "https://app.kilo.ai/config.json"\n}';
    fs.setFile(configPath, baseConfig);
    fs.setFile(`${KILO_BUILT}/.kilo/skills/aidd-vcs/01-commit/SKILL.md`, "skill");
    fs.setFile(`${KILO_BUILT}/.kilo/agents/aidd-vcs-helper.md`, "agent");
    fs.setFile(`${KILO_BUILT}/.kilo/hooks/aidd-vcs/update_memory.js`, "hook");
    fs.setFile(`${KILO_BUILT}/.kilo/plugin/aidd-vcs-hooks.js`, "bridge");
    fs.setFile(`${KILO_BUILT}/.kilo/agents/aidd-dev-helper.md`, "other");

    const manifest = Manifest.create();
    manifest.addTool(TOOL.kilo, "test", [
      new InstallationFile({
        relativePath: ".kilo/kilo.jsonc",
        content: baseConfig,
        hash: FileHash.of(baseConfig),
      }),
    ]);
    const translator = builtTreeTranslator(fs, {
      platform: process.platform,
      homedir: () => "/home/u",
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      marketplaceRegistry: await makeRegistry(),
      translate: translateDistribution,
    });
    const distribution = new PluginDistribution({
      manifest: { name: "aidd-vcs", version: "1.0.0" },
      format: TOOL.claude,
      files: [],
      components: {
        commands: [],
        agents: [],
        rules: [],
        skills: [],
        mcp: [
          {
            relativePath: ".mcp.json",
            content: JSON.stringify({
              mcpServers: { context: { command: "node", args: ["server.js"] } },
            }),
          },
        ],
        hooks: [
          { relativePath: "hooks/hooks.json", content: sessionStartHooksJson() },
          { relativePath: "hooks/update_memory.js", content: "hook" },
        ],
      },
    });

    await translator.addPlugin({
      dist: distribution,
      tool: registeredTools().aiProfile(TOOL.kilo),
      source: { kind: "local", path: "/plugin-source" },
      projectRoot: PROJECT_ROOT,
      manifest,
      marketplace: "aidd-framework",
    });

    expect(fs.getFile(`${PROJECT_ROOT}/.kilo/skills/aidd-vcs/01-commit/SKILL.md`)).toBe("skill");
    expect(fs.getFile(`${PROJECT_ROOT}/.kilo/agents/aidd-vcs-helper.md`)).toBe("agent");
    expect(fs.getFile(`${PROJECT_ROOT}/.kilo/hooks/aidd-vcs/update_memory.js`)).toBe("hook");
    expect(fs.getFile(`${PROJECT_ROOT}/.kilo/plugin/aidd-vcs-hooks.js`)).toBe("bridge");
    expect(fs.has(`${PROJECT_ROOT}/.kilo/agents/aidd-dev-helper.md`)).toBe(false);
    const config = JSON.parse(await fs.readFile(`${PROJECT_ROOT}/.kilo/kilo.jsonc`)) as {
      mcp: Record<string, { type: string }>;
    };
    expect(config.mcp.context.type).toBe("local");
    expect(
      manifest
        .getPlugins(TOOL.kilo)
        .find((p) => p.name === "aidd-vcs")
        ?.mcpEntries.get("context")
    ).toBeTruthy();
    expect(manifest.getToolFiles(TOOL.kilo)[0]?.hash).toEqual(
      FileHash.of(await fs.readFile(configPath))
    );
  });
});

function sessionStartHooksJson(): string {
  const root = "$" + "{CLAUDE_PLUGIN_ROOT}";
  return JSON.stringify({
    hooks: {
      SessionStart: [{ hooks: [{ command: `node ${root}/hooks/update_memory.js` }] }],
    },
  });
}
