/** A marketplace-sourced Cursor install must deliver hooks where a local-source one does:
 * a built tree's plugin-scoped `hooks/hooks.json` lands in a directory Cursor never reads. */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BuiltTreeMaterializationTranslator } from "../../../../../src/contexts/installation/application/materialize/built-tree-materialization-translator.js";
import { ModeBFlatMaterializationTranslator } from "../../../../../src/contexts/installation/application/materialize/mode-b-flat-materialization-translator.js";
import type { PluginTranslator } from "../../../../../src/contexts/installation/application/materialize/plugin-translator.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import { translateDistribution } from "../../../../helpers/ports/fake-build-sources.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.js";

const PROJECT_ROOT = "/proj";
const HOME = "/home/u";
const BUILT = "/built/cursor";
const PLUGIN_NAME = "sample-plugin";

// biome-ignore lint/suspicious/noTemplateCurlyInString: intentionally testing Claude hook placeholder substitution
const PLUGIN_ROOT_VAR = "${CLAUDE_PLUGIN_ROOT}";

const HOOKS_CONTENT = JSON.stringify({
  hooks: {
    PostToolUse: [
      { hooks: [{ type: "command", command: `node ${PLUGIN_ROOT_VAR}/hooks/post.js` }] },
    ],
  },
});

function dist(): PluginDistribution {
  return new PluginDistribution({
    manifest: { name: PLUGIN_NAME, version: "1.0.0" },
    format: TOOL.claude,
    files: [{ relativePath: "hooks/hooks.json", content: HOOKS_CONTENT }],
    components: {
      commands: [],
      agents: [],
      rules: [],
      skills: [],
      hooks: [
        { relativePath: "hooks/hooks.json", content: HOOKS_CONTENT },
        { relativePath: "hooks/post.js", content: "module.exports = () => {};" },
      ],
      mcp: [],
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

describe("BuiltTreeMaterializationTranslator — cursor marketplace hooks (Phase 7)", () => {
  it("merges hooks into the project's .cursor/hooks.json, not the plugin-scoped built tree", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    fs.setFile(`${BUILT}/plugins/${PLUGIN_NAME}/hooks/hooks.json`, HOOKS_CONTENT);
    fs.setFile(`${BUILT}/plugins/${PLUGIN_NAME}/hooks/post.js`, "module.exports = () => {};");
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);
    const translator = new BuiltTreeMaterializationTranslator(fs, {
      platform: process.platform,
      homedir: () => HOME,
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      marketplaceRegistry: await makeRegistry(),
      translate: translateDistribution,
    });

    const { skipped } = await translator.addPlugin(
      dist(),
      registeredTools().aiProfile(TOOL.cursor),
      { kind: "local", path: "/plugin-source" },
      PROJECT_ROOT,
      manifest,
      "aidd-framework"
    );

    const hooksPath = join(PROJECT_ROOT, ".cursor", "hooks.json");
    expect(fs.has(hooksPath)).toBe(true);
    const parsed = JSON.parse(fs.getFile(hooksPath) ?? "{}") as { hooks: Record<string, unknown> };
    expect(parsed.hooks).toHaveProperty("postToolUse");
    expect(skipped).toEqual([]);
  });

  it("writes no hooks/ path under the plugin-scoped built-tree destination", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    fs.setFile(`${BUILT}/plugins/${PLUGIN_NAME}/hooks/hooks.json`, HOOKS_CONTENT);
    fs.setFile(`${BUILT}/plugins/${PLUGIN_NAME}/hooks/post.js`, "module.exports = () => {};");
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);
    const translator = new BuiltTreeMaterializationTranslator(fs, {
      platform: process.platform,
      homedir: () => HOME,
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      marketplaceRegistry: await makeRegistry(),
      translate: translateDistribution,
    });

    await translator.addPlugin(
      dist(),
      registeredTools().aiProfile(TOOL.cursor),
      { kind: "local", path: "/plugin-source" },
      PROJECT_ROOT,
      manifest,
      "aidd-framework"
    );

    const base = `${HOME}/.cursor/plugins/local/${PLUGIN_NAME}`;
    const written = fs.listUnder(base);
    expect(written.some((p) => p.includes("hooks"))).toBe(false);
  });
});

describe("Cursor's two install routes agree on hooks destination (Phase 7, Task 2)", () => {
  async function installViaLocal(): Promise<InMemoryFileAdapter> {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);
    const translator: PluginTranslator = new ModeBFlatMaterializationTranslator(
      fs,
      () => HOME,
      translateDistribution
    );
    await translator.addPlugin(
      dist(),
      registeredTools().aiProfile(TOOL.cursor),
      { kind: "local", path: "/plugin-source" },
      PROJECT_ROOT,
      manifest,
      undefined
    );
    return fs;
  }

  async function installViaMarketplace(): Promise<InMemoryFileAdapter> {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    fs.setFile(`${BUILT}/plugins/${PLUGIN_NAME}/hooks/hooks.json`, HOOKS_CONTENT);
    fs.setFile(`${BUILT}/plugins/${PLUGIN_NAME}/hooks/post.js`, "module.exports = () => {};");
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "test", []);
    const translator: PluginTranslator = new BuiltTreeMaterializationTranslator(fs, {
      platform: process.platform,
      homedir: () => HOME,
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      marketplaceRegistry: await makeRegistry(),
      translate: translateDistribution,
    });
    await translator.addPlugin(
      dist(),
      registeredTools().aiProfile(TOOL.cursor),
      { kind: "local", path: "/plugin-source" },
      PROJECT_ROOT,
      manifest,
      "aidd-framework"
    );
    return fs;
  }

  // Read from cursor.ts's own declaration, never hard-coded: both translators regressing to
  // plugin scope together would still pass a route-against-route comparison.
  function declaredHooksDestination(toolId: AiToolId): "plugin" | "project" {
    return registeredTools().aiProfile(toolId).projectHooksDelivery() === null
      ? "plugin"
      : "project";
  }

  it("both routes write to the destination cursor.ts declares — a plugin.hooksDestination change breaks this", async () => {
    expect(declaredHooksDestination(TOOL.cursor)).toBe("project");

    const viaLocal = await installViaLocal();
    const viaMarketplace = await installViaMarketplace();

    const projectHooksPath = join(PROJECT_ROOT, ".cursor", "hooks.json");
    expect(viaLocal.has(projectHooksPath)).toBe(true);
    expect(viaMarketplace.has(projectHooksPath)).toBe(true);

    const pluginScopedBase = `${HOME}/.cursor/plugins/local/${PLUGIN_NAME}`;
    expect(viaLocal.listUnder(pluginScopedBase).some((p) => p.includes("hooks"))).toBe(false);
    expect(viaMarketplace.listUnder(pluginScopedBase).some((p) => p.includes("hooks"))).toBe(false);
  });
});
