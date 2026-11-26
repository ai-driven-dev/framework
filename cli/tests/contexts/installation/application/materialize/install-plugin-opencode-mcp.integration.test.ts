import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type FlatPlacementDeps,
  placeFlatPlugin,
} from "../../../../../src/contexts/installation/application/materialize/place-flat-plugin.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../src/shared/domain/plugin/plugin-name.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { fakeFlatDeps } from "../../testing/fake-build-sources.fake.js";

const PROJECT_ROOT = "/test-project";
const STUB_HOME = "/tmp/test-home";
const PLUGIN_NAME = "aidd-context";
const OPENCODE_JSON = join(PROJECT_ROOT, "opencode.json");

const MCP_CONTENT = JSON.stringify({
  mcpServers: {
    "local-tool": { command: "node", args: ["./server.js"] },
    "remote-tool": { url: "https://example.com/mcp" },
    "disabled-tool": { command: "python", args: ["./off.py"], disabled: true },
  },
});

function buildDist(name = PLUGIN_NAME, mcpContent = MCP_CONTENT): PluginDistribution {
  return new PluginDistribution({
    manifest: { name: parsePluginName(name), version: "1.0.0" },
    format: TOOL.claude,
    files: [{ relativePath: ".mcp.json", content: mcpContent }],
    components: {
      commands: [],
      agents: [],
      rules: [],
      skills: [],
      hooks: [],
      mcp: [{ relativePath: ".mcp.json", content: mcpContent }],
    },
  });
}

function buildAdapter(seed: Record<string, string> = {}): {
  adapter: FlatPlacementDeps;
  fs: InMemoryFileAdapter;
} {
  const fs = new InMemoryFileAdapter(seed);
  const adapter = fakeFlatDeps(fs, () => STUB_HOME);
  return { adapter, fs };
}

describe("install opencode plugin with MCP (Phase 4b integration)", () => {
  it("writes opencode.json with transformed mcp section", async () => {
    const { adapter, fs } = buildAdapter();
    const manifest = Manifest.create();
    manifest.addTool(TOOL.opencode, "test", []);

    await placeFlatPlugin(
      {
        dist: buildDist(),
        tool: registeredTools().aiProfile(TOOL.opencode),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      },
      adapter
    );

    expect(fs.has(OPENCODE_JSON)).toBe(true);
    const parsed = JSON.parse(await fs.readFile(OPENCODE_JSON)) as {
      mcp: Record<string, { enabled: boolean; type: string }>;
    };
    expect(parsed.mcp["local-tool"].type).toBe("local");
    expect(parsed.mcp["remote-tool"].type).toBe("remote");
  });

  it("preserves disabled: true → enabled: false in opencode.json", async () => {
    const { adapter, fs } = buildAdapter();
    const manifest = Manifest.create();
    manifest.addTool(TOOL.opencode, "test", []);

    await placeFlatPlugin(
      {
        dist: buildDist(),
        tool: registeredTools().aiProfile(TOOL.opencode),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      },
      adapter
    );

    const parsed = JSON.parse(await fs.readFile(OPENCODE_JSON)) as {
      mcp: Record<string, { enabled: boolean }>;
    };
    expect(parsed.mcp["disabled-tool"].enabled).toBe(false);
    expect(parsed.mcp["local-tool"].enabled).toBe(true);
    expect(parsed.mcp["remote-tool"].enabled).toBe(true);
  });

  it("populates Plugin.mcpEntries in the manifest", async () => {
    const { adapter } = buildAdapter();
    const manifest = Manifest.create();
    manifest.addTool(TOOL.opencode, "test", []);

    await placeFlatPlugin(
      {
        dist: buildDist(),
        tool: registeredTools().aiProfile(TOOL.opencode),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      },
      adapter
    );

    const installed = manifest
      .getRecordedPlugins(TOOL.opencode)
      .find((p) => p.plugin.name === PLUGIN_NAME);
    expect(installed).toBeDefined();
    expect(installed?.provenance.mcpEntries.size).toBe(3);
    expect(installed?.provenance.mcpEntries.has("local-tool")).toBe(true);
    expect(installed?.provenance.mcpEntries.has("remote-tool")).toBe(true);
    expect(installed?.provenance.mcpEntries.has("disabled-tool")).toBe(true);
  });

  it("is idempotent: second add produces byte-equal opencode.json", async () => {
    const { adapter, fs } = buildAdapter();
    const manifest = Manifest.create();
    manifest.addTool(TOOL.opencode, "test", []);

    await placeFlatPlugin(
      {
        dist: buildDist(),
        tool: registeredTools().aiProfile(TOOL.opencode),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      },
      adapter
    );
    const firstContent = await fs.readFile(OPENCODE_JSON);
    const firstPlugin = manifest
      .getRecordedPlugins(TOOL.opencode)
      .find((p) => p.plugin.name === PLUGIN_NAME);
    const firstMcpEntries = firstPlugin?.provenance.mcpEntries ?? new Map();

    // The replace path: the previous install is removed, then re-added.
    manifest.removePlugin(TOOL.opencode, PLUGIN_NAME);
    await placeFlatPlugin(
      {
        dist: buildDist(),
        tool: registeredTools().aiProfile(TOOL.opencode),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
        previousMcpEntries: firstMcpEntries,
      },
      adapter
    );
    const secondContent = await fs.readFile(OPENCODE_JSON);

    expect(secondContent).toBe(firstContent);
  });

  it("replace path: v1 {a,b} → v2 {a,c} leaves {a(v2),c}, drops b", async () => {
    const { adapter, fs } = buildAdapter();
    const manifest = Manifest.create();
    manifest.addTool(TOOL.opencode, "test", []);

    const mcpV1 = JSON.stringify({
      mcpServers: {
        "server-a": { command: "node", args: ["a.js"] },
        "server-b": { command: "node", args: ["b.js"] },
      },
    });
    await placeFlatPlugin(
      {
        dist: buildDist(PLUGIN_NAME, mcpV1),
        tool: registeredTools().aiProfile(TOOL.opencode),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      },
      adapter
    );

    const v1Plugin = manifest
      .getRecordedPlugins(TOOL.opencode)
      .find((p) => p.plugin.name === PLUGIN_NAME);
    const v1McpEntries = v1Plugin?.provenance.mcpEntries ?? new Map();
    manifest.removePlugin(TOOL.opencode, PLUGIN_NAME);

    const mcpV2 = JSON.stringify({
      mcpServers: {
        "server-a": { command: "node", args: ["a-v2.js"] },
        "server-c": { command: "node", args: ["c.js"] },
      },
    });
    await placeFlatPlugin(
      {
        dist: buildDist(PLUGIN_NAME, mcpV2),
        tool: registeredTools().aiProfile(TOOL.opencode),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
        previousMcpEntries: v1McpEntries,
      },
      adapter
    );

    const final = JSON.parse(await fs.readFile(OPENCODE_JSON)) as {
      mcp: Record<string, unknown>;
    };
    expect(final.mcp).toHaveProperty("server-a");
    expect(final.mcp).toHaveProperty("server-c");
    expect(final.mcp).not.toHaveProperty("server-b");

    const v2Plugin = manifest
      .getRecordedPlugins(TOOL.opencode)
      .find((p) => p.plugin.name === PLUGIN_NAME);
    expect(v2Plugin?.provenance.mcpEntries.has("server-a")).toBe(true);
    expect(v2Plugin?.provenance.mcpEntries.has("server-c")).toBe(true);
    expect(v2Plugin?.provenance.mcpEntries.has("server-b")).toBe(false);
  });

  it("preserves user-added servers not contributed by the plugin", async () => {
    const userServer = { type: "remote", url: "https://user.example.com/mcp", enabled: true };
    const { adapter, fs } = buildAdapter({
      [OPENCODE_JSON]: JSON.stringify({ mcp: { "user-server": userServer } }, null, 2),
    });
    const manifest = Manifest.create();
    manifest.addTool(TOOL.opencode, "test", []);

    await placeFlatPlugin(
      {
        dist: buildDist(),
        tool: registeredTools().aiProfile(TOOL.opencode),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      },
      adapter
    );

    const parsed = JSON.parse(await fs.readFile(OPENCODE_JSON)) as {
      mcp: Record<string, unknown>;
    };
    expect(parsed.mcp["user-server"]).toEqual(userServer);
    expect(parsed.mcp["local-tool"]).toBeDefined();
  });

  it("does not write opencode.json when plugin mcp is empty (no servers)", async () => {
    const emptyMcp = JSON.stringify({ mcpServers: {} });
    const { adapter, fs } = buildAdapter();
    const manifest = Manifest.create();
    manifest.addTool(TOOL.opencode, "test", []);

    await placeFlatPlugin(
      {
        dist: buildDist(PLUGIN_NAME, emptyMcp),
        tool: registeredTools().aiProfile(TOOL.opencode),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      },
      adapter
    );

    expect(fs.has(OPENCODE_JSON)).toBe(false);
    const plugins = manifest.getRecordedPlugins(TOOL.opencode);
    expect(plugins.find((p) => p.plugin.name === PLUGIN_NAME)).toBeUndefined();
  });

  it("preserves instructions key from framework-default opencode.json shape after merge", async () => {
    const frameworkDefault = JSON.stringify(
      { instructions: [".opencode/rules/**/*.md"], mcp: {} },
      null,
      2
    );
    const { adapter, fs } = buildAdapter({ [OPENCODE_JSON]: frameworkDefault });
    const manifest = Manifest.create();
    manifest.addTool(TOOL.opencode, "test", []);

    await placeFlatPlugin(
      {
        dist: buildDist(),
        tool: registeredTools().aiProfile(TOOL.opencode),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      },
      adapter
    );

    const parsed = JSON.parse(await fs.readFile(OPENCODE_JSON)) as {
      instructions: string[];
      mcp: Record<string, unknown>;
    };
    expect(parsed.instructions).toEqual([".opencode/rules/**/*.md"]);
    expect(parsed.mcp["local-tool"]).toBeDefined();
  });

  it("skips a colliding plugin server entry and preserves the user-owned server", async () => {
    const userServer = { type: "local", command: "node", args: ["user.js"], enabled: true };
    const { adapter, fs } = buildAdapter({
      [OPENCODE_JSON]: JSON.stringify({ mcp: { "local-tool": userServer } }, null, 2),
    });
    const manifest = Manifest.create();
    manifest.addTool(TOOL.opencode, "test", []);

    const { skipped } = await placeFlatPlugin(
      {
        dist: buildDist(),
        tool: registeredTools().aiProfile(TOOL.opencode),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: PROJECT_ROOT,
        manifest,
        marketplace: undefined,
      },
      adapter
    );

    // "local-tool" is user-owned - must be skipped, not overwritten
    const mcpSkip = skipped.find((s) => s.component === "mcp" && s.toolId === "opencode");
    expect(mcpSkip).toBeDefined();
    expect(mcpSkip?.reason).toContain("local-tool");
    expect(mcpSkip?.pluginName).toBe(PLUGIN_NAME);

    const parsed = JSON.parse(await fs.readFile(OPENCODE_JSON)) as {
      mcp: Record<string, unknown>;
    };
    expect(parsed.mcp["local-tool"]).toEqual(userServer);

    const installed = manifest
      .getRecordedPlugins(TOOL.opencode)
      .find((p) => p.plugin.name === PLUGIN_NAME);
    expect(installed?.provenance.mcpEntries.has("local-tool")).toBe(false);
    expect(installed?.provenance.mcpEntries.has("remote-tool")).toBe(true);
  });
});
