import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createPluginTranslation } from "../../../../../src/composition/contexts/translate.js";
import {
  materializeFlatMcp,
  refreshTrackedMcpConfigHash,
} from "../../../../../src/contexts/installation/application/materialize/flat-mcp-materializer.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../src/shared/domain/plugin/plugin-name.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const PROJECT_ROOT = resolve("/test-project");
const OPENCODE_JSON = join(PROJECT_ROOT, "opencode.json");

function dist(mcp: readonly string[]): PluginDistribution {
  return new PluginDistribution({
    manifest: { name: parsePluginName("ctx"), version: "1.0.0" },
    format: TOOL.claude,
    files: [],
    components: {
      commands: [],
      agents: [],
      rules: [],
      skills: [],
      hooks: [],
      mcp: mcp.map((content) => ({ relativePath: ".mcp.json", content })),
    },
  });
}

/** What the engine hands an install to merge: the plugin's servers in the tool's own shape. */
const declared = (mcp: readonly string[]) =>
  createPluginTranslation(registeredTools()).execute({ distribution: dist(mcp), tool: opencode() })
    .installedMcp;

const SERVER = JSON.stringify({ mcpServers: { local: { command: "node", args: ["s.js"] } } });
const opencode = () => registeredTools().aiProfile(TOOL.opencode);

describe("materializing a plugin's MCP servers into a flat config", () => {
  it("answers nothing and writes nothing for a plugin without MCP servers", async () => {
    const fs = new InMemoryFileAdapter();
    const result = await materializeFlatMcp({
      fs,
      pluginName: "ctx",
      declaration: declared([]),
      tool: opencode(),
      projectRoot: PROJECT_ROOT,
      previousMcpEntries: new Map(),
    });
    expect(result.mcpEntries.size).toBe(0);
    expect(result.outputRelPath).toBeUndefined();
    expect(fs.has(OPENCODE_JSON)).toBe(false);
  });

  it("writes the tool's config and reports the entries the plugin contributed", async () => {
    const fs = new InMemoryFileAdapter();
    const result = await materializeFlatMcp({
      fs,
      pluginName: "ctx",
      declaration: declared([SERVER]),
      tool: opencode(),
      projectRoot: PROJECT_ROOT,
      previousMcpEntries: new Map(),
    });
    expect([...result.mcpEntries.keys()]).toEqual(["local"]);
    expect(result.outputRelPath).toBeDefined();
    expect(JSON.parse(await fs.readFile(OPENCODE_JSON)).mcp.local.type).toBe("local");
  });

  it("keeps what the config already holds", async () => {
    const fs = new InMemoryFileAdapter({
      [OPENCODE_JSON]: JSON.stringify({ theme: "dark", mcp: { mine: { type: "remote" } } }),
    });
    await materializeFlatMcp({
      fs,
      pluginName: "ctx",
      declaration: declared([SERVER]),
      tool: opencode(),
      projectRoot: PROJECT_ROOT,
      previousMcpEntries: new Map(),
    });
    const config = JSON.parse(await fs.readFile(OPENCODE_JSON));
    expect(config.theme).toBe("dark");
    expect(Object.keys(config.mcp).sort()).toEqual(["local", "mine"]);
  });

  it("refuses to reinstall over an entry edited since the install", async () => {
    const fs = new InMemoryFileAdapter();
    const first = await materializeFlatMcp({
      fs,
      pluginName: "ctx",
      declaration: declared([SERVER]),
      tool: opencode(),
      projectRoot: PROJECT_ROOT,
      previousMcpEntries: new Map(),
    });
    const config = JSON.parse(await fs.readFile(OPENCODE_JSON));
    config.mcp.local.command = ["edited"];
    fs.setFile(OPENCODE_JSON, JSON.stringify(config));
    await expect(
      materializeFlatMcp({
        fs,
        pluginName: "ctx",
        declaration: declared([SERVER]),
        tool: opencode(),
        projectRoot: PROJECT_ROOT,
        previousMcpEntries: first.mcpEntries,
      })
    ).rejects.toThrow("MCP server 'local' was edited after install; reinstall refused.");
  });
});

describe("after the install rewrote a tracked MCP config", () => {
  const STALE = FileHash.of("before the install");

  function manifestTracking(): Manifest {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.opencode, "test", [
      new InstallationFile({ relativePath: "opencode.json", content: "", hash: STALE }),
    ]);
    return manifest;
  }

  const refresh = (fs: InMemoryFileAdapter, manifest: Manifest, outputRelPath: string) =>
    refreshTrackedMcpConfigHash({
      fs,
      manifest,
      toolId: TOOL.opencode,
      projectRoot: PROJECT_ROOT,
      outputRelPath,
    });

  it("rehashes a tracked config the install just rewrote", async () => {
    const fs = new InMemoryFileAdapter({ [OPENCODE_JSON]: "{}" });
    const manifest = manifestTracking();
    await refresh(fs, manifest, "opencode.json");
    expect(manifest.getToolFiles(TOOL.opencode)[0].hash).toEqual(FileHash.of("{}"));
  });
});
