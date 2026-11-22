/**
 * hooks.json is not tracked in Plugin.files: hooksDestination:"project" merges its entries
 * into the project's own .cursor/hooks.json, which baseDir-relative deletion cannot find.
 */

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createOutput } from "../../../../../src/composition/shared.js";
import { placeFlatPlugin } from "../../../../../src/contexts/installation/application/materialize/place-flat-plugin.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import type { ProjectHooksProvenance } from "../../../../../src/contexts/installation/domain/plugins/plugin-entry.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../../shared/testing/saying.builder.js";
import { fakeFlatDeps } from "../../testing/fake-build-sources.fake.js";
import { pluginRemover } from "../../testing/plugin-remover.builder.js";

const STUB_HOME = "/tmp/test-home";
const PROJECT_ROOT = "/test-project";
const PLUGIN_NAME = "aidd-context";
const OTHER_PLUGIN_NAME = "aidd-context-two";
const _RESOLVED_BASE = join(STUB_HOME, ".cursor", "plugins", "local");
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
    format: TOOL.claude,
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
    format: TOOL.claude,
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
  const adapter = fakeFlatDeps(fs, () => STUB_HOME);
  await placeFlatPlugin(
    {
      dist: buildDist(name),
      tool: registeredTools().aiProfile(TOOL.cursor),
      source: { kind: "local", path: "/plugin-source" },
      projectRoot: PROJECT_ROOT,
      manifest,
      marketplace: undefined,
      previousMcpEntries: new Map(),
      userScopeDirTaken: false,
      previousProjectHooks: previous,
    },
    adapter
  );
}

describe("plugin remove unmerges Cursor project hooks (Phase 7, Task 3)", () => {
  it("removes what an install merged and copied, leaving every other plugin's entries untouched", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);
    await installPlugin(fs, manifest, PLUGIN_NAME);
    await installPlugin(fs, manifest, OTHER_PLUGIN_NAME);
    const manifestRepo = new InMemoryManifestRepository(manifest);
    await manifestRepo.save(manifest);
    expect(fs.has(SCRIPT_PATH)).toBe(true);
    expect(fs.has(OTHER_SCRIPT_PATH)).toBe(true);

    const removeUseCase = pluginRemover({ fs, manifestRepo, logger: createOutput(false) });
    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: [TOOL.cursor],
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
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);
    await installPlugin(fs, manifest, PLUGIN_NAME);
    const previous = manifest.getRecordedPlugins(TOOL.cursor)[0].provenance.projectHooks;
    manifest.removePlugin(TOOL.cursor, PLUGIN_NAME);
    await installPlugin(fs, manifest, PLUGIN_NAME, previous);

    const parsed = JSON.parse(await fs.readFile(HOOKS_PATH)) as {
      hooks: Record<string, Array<{ command: string }>>;
    };
    expect(parsed.hooks.preToolUse).toHaveLength(1);
  });

  it("refuses reinstall if the previous hook script was edited", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);
    await installPlugin(fs, manifest, PLUGIN_NAME);
    const previous = manifest.getRecordedPlugins(TOOL.cursor)[0].provenance.projectHooks;
    fs.setFile(SCRIPT_PATH, "edited by user");
    manifest.removePlugin(TOOL.cursor, PLUGIN_NAME);
    await expect(installPlugin(fs, manifest, PLUGIN_NAME, previous)).rejects.toThrow(
      saying(/edited/)
    );
    expect(fs.getFile(SCRIPT_PATH)).toBe("edited by user");
  });

  it("removes verified prior project hooks when a replacement no longer carries hooks", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);
    await installPlugin(fs, manifest, PLUGIN_NAME);
    const previous = manifest.getRecordedPlugins(TOOL.cursor)[0].provenance.projectHooks;
    manifest.removePlugin(TOOL.cursor, PLUGIN_NAME);
    const translator = fakeFlatDeps(fs, () => STUB_HOME);
    await placeFlatPlugin(
      {
        dist: buildWithoutHooks(PLUGIN_NAME),
        tool: registeredTools().aiProfile(TOOL.cursor),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
        previousMcpEntries: new Map(),
        userScopeDirTaken: false,
        previousProjectHooks: previous,
      },
      translator
    );
    expect(fs.has(HOOKS_PATH)).toBe(false);
    expect(fs.has(SCRIPT_PATH)).toBe(false);
    expect(manifest.getRecordedPlugins(TOOL.cursor)[0].provenance.projectHooks).toBeUndefined();
  });

  it("refuses to remove an edited project hook script without detaching the plugin record", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);
    await installPlugin(fs, manifest, PLUGIN_NAME);
    fs.setFile(SCRIPT_PATH, "user-edited script");
    const repo = new InMemoryManifestRepository(manifest);
    const remove = pluginRemover({ fs, manifestRepo: repo, logger: createOutput(false) });
    await expect(
      remove.execute({
        pluginName: PLUGIN_NAME,
        toolIds: [TOOL.cursor],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(saying(/edited.*pre.js|pre.js.*edited/));
    expect(fs.getFile(SCRIPT_PATH)).toBe("user-edited script");
    expect(
      repo
        .getCurrent()
        ?.getRecordedPlugins(TOOL.cursor)
        .some((p) => p.plugin.name === PLUGIN_NAME)
    ).toBe(true);
  });

  it("refuses to strip an edited hook command entry and preserves other plugins", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);
    await installPlugin(fs, manifest, PLUGIN_NAME);
    await installPlugin(fs, manifest, OTHER_PLUGIN_NAME);
    const hooks = JSON.parse(fs.getFile(HOOKS_PATH) ?? "null") as {
      hooks: { preToolUse: Array<{ command: string }> };
    };
    hooks.hooks.preToolUse[0].command += " --user-flag";
    fs.setFile(HOOKS_PATH, JSON.stringify(hooks));
    const repo = new InMemoryManifestRepository(manifest);
    const remove = pluginRemover({ fs, manifestRepo: repo, logger: createOutput(false) });
    await expect(
      remove.execute({
        pluginName: PLUGIN_NAME,
        toolIds: [TOOL.cursor],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(saying(/edited.*hooks|hooks.*edited/));
    expect(fs.getFile(HOOKS_PATH)).toContain("--user-flag");
    expect(fs.has(OTHER_SCRIPT_PATH)).toBe(true);
    expect(repo.getCurrent()?.getRecordedPlugins(TOOL.cursor)).toHaveLength(2);
  });

  it("does not delete an untracked user script just because it shares a plugin directory", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);
    await installPlugin(fs, manifest, PLUGIN_NAME);
    const userScript = join(PROJECT_ROOT, ".cursor", "hooks", PLUGIN_NAME, "user.js");
    fs.setFile(userScript, "user owned");
    const repo = new InMemoryManifestRepository(manifest);
    const remove = pluginRemover({ fs, manifestRepo: repo, logger: createOutput(false) });
    await remove.execute({
      pluginName: PLUGIN_NAME,
      toolIds: [TOOL.cursor],
      projectRoot: PROJECT_ROOT,
    });
    expect(fs.has(SCRIPT_PATH)).toBe(false);
    expect(fs.getFile(userScript)).toBe("user owned");
  });
});
