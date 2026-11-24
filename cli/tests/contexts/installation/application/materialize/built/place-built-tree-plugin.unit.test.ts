import { describe, expect, it, vi } from "vitest";
import { placementDepsOf } from "../../../../../../src/composition/orchestration/built-placement.js";
import type { AddPluginRequest } from "../../../../../../src/contexts/installation/application/materialize/add-plugin-request.js";
import { placeBuiltTreePlugin } from "../../../../../../src/contexts/installation/application/materialize/built/place-built-tree-plugin.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { PluginDistribution } from "../../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../../src/shared/domain/plugin/plugin-name.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { fakeBuiltDeps, translateDistribution } from "../../../testing/fake-build-sources.fake.js";
import { FakeMarketplaceRegistry } from "../../../testing/fake-marketplace-registry.fake.js";

const PROJECT_ROOT = "/proj";
const HOME = "/home/u";
const BUILT = "/built/cursor";

function dist(): PluginDistribution {
  return new PluginDistribution({
    manifest: { name: parsePluginName("sample-plugin"), version: "1.0.0" },
    format: TOOL.claude,
    files: [],
    components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
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

describe("placeBuiltTreePlugin - cursor", () => {
  it("counts changed files and skips byte-identical files on repeated materialization", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(`${BUILT}/plugins/sample-plugin/skills/demo/SKILL.md`, "built skill");
    const translator = placementDepsOf(
      fs,
      fakeBuiltDeps({ homedir: () => HOME, marketplaceRegistry: await makeRegistry() })
    );
    const install = () => {
      const restored = Manifest.create();
      restored.addTool(TOOL.cursor, "test", []);
      return placeBuiltTreePlugin(
        {
          dist: dist(),
          tool: registeredTools().aiProfile(TOOL.cursor),
          source: { kind: "local", path: "/source" },
          projectRoot: PROJECT_ROOT,
          manifest: restored,
          marketplace: "aidd-framework",
        },
        translator
      );
    };
    const first = await install();
    expect(first.written).toBe(1);
    const writes = vi.spyOn(fs, "writeFile");
    expect((await install()).written).toBe(0);
    expect(writes).not.toHaveBeenCalled();
    fs.setFile(
      `${HOME}/.cursor/plugins/local/sample-plugin/skills/demo/SKILL.md`,
      "changed by user"
    );
    expect((await install()).written).toBe(1);
    expect(
      await fs.readFile(`${HOME}/.cursor/plugins/local/sample-plugin/skills/demo/SKILL.md`)
    ).toBe("built skill");
  });

  it("translates one install request once, for the built-tree read and the mcp merge together", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(`${BUILT}/plugins/sample-plugin/skills/demo/SKILL.md`, "built skill");
    const execute = vi.fn(translateDistribution.execute.bind(translateDistribution));
    const translator = placementDepsOf(
      fs,
      fakeBuiltDeps({
        homedir: () => HOME,
        marketplaceRegistry: await makeRegistry(),
        translate: { execute },
      })
    );
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);
    await placeBuiltTreePlugin(
      {
        dist: dist(),
        tool: registeredTools().aiProfile(TOOL.cursor),
        source: { kind: "local", path: "/source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: "aidd-framework",
      },
      translator
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("copies the built plugin subtree verbatim into the user plugin dir", async () => {
    const fs = new InMemoryFileAdapter();
    // Built cursor tree (transformed content already): @ expanded, .mdc rule, dotted .mcp.json.
    const skill = "Load [assets/x.md](../assets/x.md)";
    fs.setFile(`${BUILT}/plugins/sample-plugin/skills/demo/SKILL.md`, skill);
    fs.setFile(`${BUILT}/plugins/sample-plugin/rules/r.mdc`, "rule body");
    fs.setFile(`${BUILT}/plugins/sample-plugin/.mcp.json`, "{}");
    fs.setFile(
      `${BUILT}/plugins/sample-plugin/.cursor-plugin/plugin.json`,
      '{"name":"sample-plugin"}'
    );

    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);
    const translator = placementDepsOf(
      fs,
      fakeBuiltDeps({ homedir: () => HOME, marketplaceRegistry: await makeRegistry() })
    );

    await placeBuiltTreePlugin(
      {
        dist: dist(),
        tool: registeredTools().aiProfile(TOOL.cursor),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: "aidd-framework",
      },
      translator
    );

    const base = `${HOME}/.cursor/plugins/local/sample-plugin`;
    // Byte-equal to the built tree, with the plugins/<name> prefix stripped.
    expect(fs.getFile(`${base}/skills/demo/SKILL.md`)).toBe(skill);
    expect(fs.getFile(`${base}/rules/r.mdc`)).toBe("rule body");
    // .mcp.json keeps its dotted name (came from build, not remapped to mcp.json).
    expect(fs.getFile(`${base}/.mcp.json`)).toBe("{}");
    const installed = manifest.getPlugins(TOOL.cursor).find((p) => p.name === "sample-plugin");
    expect(installed?.files.size).toBe(4);
  });

  describe("replacing a plugin whose new built tree drops a file", () => {
    async function replaceDroppingOldRule(userScopeDirTaken: boolean): Promise<string[]> {
      const fs = new InMemoryFileAdapter();
      const root = `${BUILT}/plugins/sample-plugin`;
      fs.setFile(`${root}/skills/demo/SKILL.md`, "built skill");
      fs.setFile(`${root}/rules/old.mdc`, "old rule");
      const manifest = Manifest.create();
      manifest.addTool(TOOL.cursor, "test", []);
      const translator = placementDepsOf(
        fs,
        fakeBuiltDeps({ homedir: () => HOME, marketplaceRegistry: await makeRegistry() })
      );
      const place = (extra: Partial<AddPluginRequest>) =>
        placeBuiltTreePlugin(
          {
            dist: dist(),
            tool: registeredTools().aiProfile(TOOL.cursor),
            source: { kind: "local", path: "/source" },
            projectRoot: PROJECT_ROOT,
            manifest,
            marketplace: "aidd-framework",
            ...extra,
          },
          translator
        );
      await place({});
      const previousFiles = manifest.getPlugins(TOOL.cursor)[0]?.files;
      manifest.removePlugin(TOOL.cursor, "sample-plugin");
      await fs.deleteFile(`${root}/rules/old.mdc`);

      await place({ previousFiles, userScopeDirTaken });

      return fs.listUnder(`${HOME}/.cursor/plugins/local`);
    }

    it("deletes the file the previous version recorded", async () => {
      expect(await replaceDroppingOldRule(false)).toStrictEqual([
        `${HOME}/.cursor/plugins/local/sample-plugin/skills/demo/SKILL.md`,
      ]);
    });

    it("keeps it when the plugin directory belongs to someone else", async () => {
      expect(await replaceDroppingOldRule(true)).toContain(
        `${HOME}/.cursor/plugins/local/sample-plugin/rules/old.mdc`
      );
    });
  });

  it("does not rewrite or claim an occupied Cursor user plugin directory", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(`${BUILT}/plugins/sample-plugin/skills/demo/SKILL.md`, "built bytes");
    const occupied = `${HOME}/.cursor/plugins/local/sample-plugin/skills/demo/SKILL.md`;
    fs.setFile(occupied, "foreign bytes");
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);
    const translator = placementDepsOf(
      fs,
      fakeBuiltDeps({ homedir: () => HOME, marketplaceRegistry: await makeRegistry() })
    );

    const result = await placeBuiltTreePlugin(
      {
        dist: dist(),
        tool: registeredTools().aiProfile(TOOL.cursor),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: "aidd-framework",
        previousMcpEntries: new Map(),
        userScopeDirTaken: true,
      },
      translator
    );
    expect(result.written).toBe(0);
    expect(fs.getFile(occupied)).toBe("foreign bytes");
    expect(manifest.getPlugins(TOOL.cursor)[0]?.files.size).toBe(0);
  });

  it("falls back to flat materialization when no marketplace is given (raw local install)", async () => {
    const fs = new InMemoryFileAdapter();
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);
    const translator = placementDepsOf(
      fs,
      fakeBuiltDeps({ homedir: () => HOME, marketplaceRegistry: await makeRegistry() })
    );
    const result = await placeBuiltTreePlugin(
      {
        dist: dist(),
        tool: registeredTools().aiProfile(TOOL.cursor),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      },
      translator
    );
    expect(result.skipped).toEqual([]);
  });
});

describe("placeBuiltTreePlugin - when no built tree applies", () => {
  const COMMAND = "---\nname: aidd:01:hello\n---\n# Hello";

  function distWithCommand(): PluginDistribution {
    return new PluginDistribution({
      manifest: { name: parsePluginName("sample-plugin"), version: "1.0.0" },
      format: TOOL.claude,
      files: [{ relativePath: "commands/hello.md", content: COMMAND }],
      components: {
        commands: [{ relativePath: "commands/hello.md", content: COMMAND }],
        agents: [],
        rules: [],
        skills: [],
        hooks: [],
        mcp: [],
      },
    });
  }

  async function install(marketplace: string | undefined): Promise<InMemoryFileAdapter> {
    const fs = new InMemoryFileAdapter();
    fs.setFile(`${BUILT}/plugins/sample-plugin/skills/demo/SKILL.md`, "built skill");
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);
    const translator = placementDepsOf(
      fs,
      fakeBuiltDeps({ homedir: () => HOME, marketplaceRegistry: await makeRegistry() })
    );
    await placeBuiltTreePlugin(
      {
        dist: distWithCommand(),
        tool: registeredTools().aiProfile(TOOL.cursor),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace,
      },
      translator
    );
    return fs;
  }

  it("materializes the distribution itself, never the built tree, when no marketplace is given", async () => {
    const fs = await install(undefined);

    expect(fs.listUnder(`${HOME}/.cursor/plugins/local`)).toStrictEqual([
      `${HOME}/.cursor/plugins/local/sample-plugin/commands/hello.md`,
    ]);
  });

  it("materializes the distribution itself when the named marketplace is not registered", async () => {
    const fs = await install("unregistered-marketplace");

    expect(fs.listUnder(`${HOME}/.cursor/plugins/local`)).toStrictEqual([
      `${HOME}/.cursor/plugins/local/sample-plugin/commands/hello.md`,
    ]);
  });
});
