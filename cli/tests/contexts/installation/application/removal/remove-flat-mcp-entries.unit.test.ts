import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { removeFlatMcpEntries } from "../../../../../src/contexts/installation/application/removal/remove-flat-mcp-entries.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const ROOT = "/project";
const MCP_FILE = join(ROOT, "opencode.json");
const tool = registeredTools().aiProfile(TOOL.opencode);

function plugin(entries?: ReadonlyMap<string, string>): RecordedPlugin {
  const base = RecordedPlugin.fromMetadata({
    name: "aidd-dev",
    version: "1.0.0",
    source: { kind: "local", path: "/fixture" },
    strict: false,
    scope: "project",
  });
  return entries === undefined ? base : base.withMcpEntries(entries);
}

function contributed() {
  const mcp = tool.flatPluginMcp();
  if (mcp === null) throw new Error("opencode answers a flat mcp file");
  const merged = mcp.mergePluginServers(
    null,
    mcp.transform(JSON.stringify({ mcpServers: { srv: { command: "node", args: ["x"] } } })),
    new Map()
  );
  return { content: merged.mergedContent, entries: merged.contributedEntries };
}

describe("removing a plugin's MCP servers from a flat config", () => {
  it("writes the config back without the servers the plugin contributed", async () => {
    const { content, entries } = contributed();
    const fs = new InMemoryFileAdapter({ [MCP_FILE]: content }, [ROOT]);

    await removeFlatMcpEntries(fs, { plugin: plugin(entries), tool, projectRoot: ROOT });

    expect(Object.keys(JSON.parse(await fs.readFile(MCP_FILE)).mcp ?? {})).toStrictEqual([]);
  });

  it("leaves the config alone when the plugin recorded no server", async () => {
    const fs = new InMemoryFileAdapter({ [MCP_FILE]: "{}" }, [ROOT]);

    await removeFlatMcpEntries(fs, { plugin: plugin(), tool, projectRoot: ROOT });

    expect(await fs.readFile(MCP_FILE)).toBe("{}");
  });

  it("creates nothing when the config file is absent", async () => {
    const { entries } = contributed();
    const fs = new InMemoryFileAdapter({}, [ROOT]);

    await removeFlatMcpEntries(fs, { plugin: plugin(entries), tool, projectRoot: ROOT });

    expect(await fs.fileExists(MCP_FILE)).toBe(false);
  });
});
