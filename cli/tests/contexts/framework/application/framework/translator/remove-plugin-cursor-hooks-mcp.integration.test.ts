/**
 * hooks.json is not tracked in Plugin.files: hooksDestination:"project" merges its entries
 * into the project's own .cursor/hooks.json, which baseDir-relative deletion cannot find.
 */
import "../../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ModeBFlatMaterializationTranslator } from "../../../../../../src/contexts/framework/application/framework/translator/mode-b-flat-materialization-translator.js";
import { PluginRemoveUseCase } from "../../../../../../src/contexts/framework/application/plugin/plugin-remove-use-case.js";
import { Manifest } from "../../../../../../src/contexts/framework/domain/manifest.js";
import type { ProjectHooksProvenance } from "../../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { PluginDistribution } from "../../../../../../src/contexts/translate/domain/plugin-distribution.js";
import { CLIOutput } from "../../../../../../src/presentation/output.js";
import { DeterministicHasher } from "../../../../../helpers/ports/deterministic-hasher.js";
import { InMemoryFileAdapter } from "../../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../../helpers/ports/in-memory-manifest-repository.js";

const STUB_HOME = "/tmp/test-home";
const PROJECT_ROOT = "/test-project";
const PLUGIN_NAME = "aidd-context";
const OTHER_PLUGIN_NAME = "aidd-context-two";
const RESOLVED_BASE = join(STUB_HOME, ".cursor", "plugins", "local");
const HOOKS_PATH = join(PROJECT_ROOT, ".cursor", "hooks.json");
const SCRIPT_PATH = join(PROJECT_ROOT, ".cursor", "hooks", PLUGIN_NAME, "pre.js");
const OTHER_SCRIPT_PATH = join(PROJECT_ROOT, ".cursor", "hooks", OTHER_PLUGIN_NAME, "pre.js");

// biome-ignore lint/suspicious/noTemplateCurlyInString: intentionally testing Claude hook placeholder substitution
const PLUGIN_ROOT_VAR = "${CLAUDE_PLUGIN_ROOT}";

const HOOKS_CONTENT = JSON.stringify({
  hooks: {
    PreToolUse: [
      {
        hooks: [{ type: "command", command: `node ${PLUGIN_ROOT_VAR}/hooks/pre.js` }],
      },
    ],
  },
});

const MCP_CONTENT = JSON.stringify({
  mcpServers: {
    "local-tool": { command: "node", args: ["./mcp-server.js"] },
  },
});

function buildDist(name: string): PluginDistribution {
  return new PluginDistribution({
    manifest: { name, version: "1.0.0" },
    format: "claude",
    files: [
      { relativePath: "hooks/hooks.json", content: HOOKS_CONTENT },
      { relativePath: "hooks/pre.js", content: "module.exports = () => {};" },
      { relativePath: ".mcp.json", content: MCP_CONTENT },
    ],
    components: {
      commands: [],
      agents: [],
      rules: [],
      skills: [],
      hooks: [
        { relativePath: "hooks/hooks.json", content: HOOKS_CONTENT },
        { relativePath: "hooks/pre.js", content: "module.exports = () => {};" },
      ],
      mcp: [{ relativePath: ".mcp.json", content: MCP_CONTENT }],
    },
  });
}

function buildWithoutHooks(name: string): PluginDistribution {
  return new PluginDistribution({
    manifest: { name, version: "1.1.0" },
    format: "claude",
    files: [{ relativePath: ".mcp.json", content: MCP_CONTENT }],
    components: {
      commands: [],
      agents: [],
      rules: [],
      skills: [],
      hooks: [],
      mcp: [{ relativePath: ".mcp.json", content: MCP_CONTENT }],
    },
  });
}

async function installPlugin(
  fs: InMemoryFileAdapter,
  manifest: Manifest,
  name: string,
  previous?: ProjectHooksProvenance
) {
  const adapter = new ModeBFlatMaterializationTranslator(
    fs,
    new DeterministicHasher(),
    () => STUB_HOME
  );
  await adapter.addPlugin(
    buildDist(name),
    "cursor",
    { kind: "local", path: "/plugin-source" },
    PROJECT_ROOT,
    manifest,
    undefined,
    new Map(),
    false,
    previous
  );
}

describe("Cursor plugin.files tracking enables uninstall of mcp.json; hooks.json is out-of-band (Phase 6)", () => {
  it("Plugin.files keys join to the exact written absolute paths (uninstall can find the files)", async () => {
    const fs = new InMemoryFileAdapter();
    const manifest = Manifest.create();
    manifest.addTool("cursor", "test", []);

    await installPlugin(fs, manifest, PLUGIN_NAME);

    const plugins = manifest.getPlugins("cursor");
    const installed = plugins.find((p) => p.name === PLUGIN_NAME);
    expect(installed).toBeDefined();
    const keys = [...(installed?.files.keys() ?? [])];
    expect(keys.some((k) => k.endsWith("hooks.json"))).toBe(false);
    expect(keys.some((k) => k.endsWith("mcp.json"))).toBe(true);
    // Every tracked key, when joined with resolvedBase, must match a written file
    for (const key of keys) {
      const absPath = join(RESOLVED_BASE, key);
      expect(fs.has(absPath)).toBe(true);
    }
    // hooks.json was still written - just not tracked in Plugin.files, and not here
    expect(fs.has(HOOKS_PATH)).toBe(true);
    expect(installed?.projectHooks?.entries).toHaveLength(1);
    expect([...(installed?.projectHooks?.scripts ?? new Map()).keys()]).toEqual([
      `.cursor/hooks/${PLUGIN_NAME}/pre.js`,
    ]);
  });
});

describe("plugin remove unmerges Cursor project hooks (Phase 7, Task 3)", () => {
  it("removes what an install merged and copied, leaving every other plugin's entries untouched", async () => {
    const fs = new InMemoryFileAdapter();
    const manifest = Manifest.create();
    manifest.addTool("cursor", "test", []);
    await installPlugin(fs, manifest, PLUGIN_NAME);
    await installPlugin(fs, manifest, OTHER_PLUGIN_NAME);
    const manifestRepo = new InMemoryManifestRepository(manifest);
    await manifestRepo.save(manifest);
    expect(fs.has(SCRIPT_PATH)).toBe(true);
    expect(fs.has(OTHER_SCRIPT_PATH)).toBe(true);

    const removeUseCase = new PluginRemoveUseCase(
      fs,
      manifestRepo,
      new CLIOutput(false),
      new Map()
    );
    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["cursor"],
      projectRoot: PROJECT_ROOT,
    });

    const parsed = JSON.parse(await fs.readFile(HOOKS_PATH)) as {
      hooks: Record<string, Array<{ command: string }>>;
    };
    const commands = parsed.hooks.preToolUse.map((e) => e.command);
    expect(commands.some((c) => c.includes(`/${PLUGIN_NAME}/`))).toBe(false);
    expect(commands.some((c) => c.includes(`/${OTHER_PLUGIN_NAME}/`))).toBe(true);
    expect(fs.has(SCRIPT_PATH)).toBe(false);
    expect(fs.has(OTHER_SCRIPT_PATH)).toBe(true);
  });

  it("installing the same plugin twice leaves one copy in .cursor/hooks.json", async () => {
    // Mirrors `aidd plugin install --replace`: the manifest entry is dropped before re-adding,
    // but the .cursor/hooks.json this plugin already merged into is untouched by that drop.
    const fs = new InMemoryFileAdapter();
    const manifest = Manifest.create();
    manifest.addTool("cursor", "test", []);
    await installPlugin(fs, manifest, PLUGIN_NAME);
    const previous = manifest.getPlugins("cursor")[0].projectHooks;
    manifest.removePlugin("cursor", PLUGIN_NAME);
    await installPlugin(fs, manifest, PLUGIN_NAME, previous);

    const parsed = JSON.parse(await fs.readFile(HOOKS_PATH)) as {
      hooks: Record<string, Array<{ command: string }>>;
    };
    expect(parsed.hooks.preToolUse).toHaveLength(1);
  });

  it("refuses reinstall if the previous hook script was edited", async () => {
    const fs = new InMemoryFileAdapter();
    const manifest = Manifest.create();
    manifest.addTool("cursor", "test", []);
    await installPlugin(fs, manifest, PLUGIN_NAME);
    const previous = manifest.getPlugins("cursor")[0].projectHooks;
    fs.setFile(SCRIPT_PATH, "edited by user");
    manifest.removePlugin("cursor", PLUGIN_NAME);
    await expect(installPlugin(fs, manifest, PLUGIN_NAME, previous)).rejects.toThrow(/edited/);
    expect(fs.getFile(SCRIPT_PATH)).toBe("edited by user");
  });

  it("removes verified prior project hooks when a replacement no longer carries hooks", async () => {
    const fs = new InMemoryFileAdapter();
    const manifest = Manifest.create();
    manifest.addTool("cursor", "test", []);
    await installPlugin(fs, manifest, PLUGIN_NAME);
    const previous = manifest.getPlugins("cursor")[0].projectHooks;
    manifest.removePlugin("cursor", PLUGIN_NAME);
    const translator = new ModeBFlatMaterializationTranslator(
      fs,
      new DeterministicHasher(),
      () => STUB_HOME
    );
    await translator.addPlugin(
      buildWithoutHooks(PLUGIN_NAME),
      "cursor",
      { kind: "local", path: "/plugin-source" },
      PROJECT_ROOT,
      manifest,
      undefined,
      new Map(),
      false,
      previous
    );
    expect(fs.has(HOOKS_PATH)).toBe(false);
    expect(fs.has(SCRIPT_PATH)).toBe(false);
    expect(manifest.getPlugins("cursor")[0].projectHooks).toBeUndefined();
  });

  it("refuses to remove an edited project hook script without detaching the plugin record", async () => {
    const fs = new InMemoryFileAdapter();
    const manifest = Manifest.create();
    manifest.addTool("cursor", "test", []);
    await installPlugin(fs, manifest, PLUGIN_NAME);
    fs.setFile(SCRIPT_PATH, "user-edited script");
    const repo = new InMemoryManifestRepository(manifest);
    const remove = new PluginRemoveUseCase(fs, repo, new CLIOutput(false), new Map());
    await expect(
      remove.execute({ pluginName: PLUGIN_NAME, toolIds: ["cursor"], projectRoot: PROJECT_ROOT })
    ).rejects.toThrow(/edited.*pre.js|pre.js.*edited/);
    expect(fs.getFile(SCRIPT_PATH)).toBe("user-edited script");
    expect(
      repo
        .getCurrent()
        ?.getPlugins("cursor")
        .some((p) => p.name === PLUGIN_NAME)
    ).toBe(true);
  });

  it("refuses to strip an edited hook command entry and preserves other plugins", async () => {
    const fs = new InMemoryFileAdapter();
    const manifest = Manifest.create();
    manifest.addTool("cursor", "test", []);
    await installPlugin(fs, manifest, PLUGIN_NAME);
    await installPlugin(fs, manifest, OTHER_PLUGIN_NAME);
    const hooks = JSON.parse(fs.getFile(HOOKS_PATH) ?? "null") as {
      hooks: { preToolUse: Array<{ command: string }> };
    };
    hooks.hooks.preToolUse[0].command += " --user-flag";
    fs.setFile(HOOKS_PATH, JSON.stringify(hooks));
    const repo = new InMemoryManifestRepository(manifest);
    const remove = new PluginRemoveUseCase(fs, repo, new CLIOutput(false), new Map());
    await expect(
      remove.execute({ pluginName: PLUGIN_NAME, toolIds: ["cursor"], projectRoot: PROJECT_ROOT })
    ).rejects.toThrow(/edited.*hooks|hooks.*edited/);
    expect(fs.getFile(HOOKS_PATH)).toContain("--user-flag");
    expect(fs.has(OTHER_SCRIPT_PATH)).toBe(true);
    expect(repo.getCurrent()?.getPlugins("cursor")).toHaveLength(2);
  });

  it("does not delete an untracked user script just because it shares a plugin directory", async () => {
    const fs = new InMemoryFileAdapter();
    const manifest = Manifest.create();
    manifest.addTool("cursor", "test", []);
    await installPlugin(fs, manifest, PLUGIN_NAME);
    const userScript = join(PROJECT_ROOT, ".cursor", "hooks", PLUGIN_NAME, "user.js");
    fs.setFile(userScript, "user owned");
    const repo = new InMemoryManifestRepository(manifest);
    const remove = new PluginRemoveUseCase(fs, repo, new CLIOutput(false), new Map());
    await remove.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["cursor"],
      projectRoot: PROJECT_ROOT,
    });
    expect(fs.has(SCRIPT_PATH)).toBe(false);
    expect(fs.getFile(userScript)).toBe("user owned");
  });
});
