import { join } from "node:path";
import { RecordedPlugin } from "../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";

export const MCP_ROOT = "/project";
export const MCP_FILE = join(MCP_ROOT, "opencode.json");
export const opencode = registeredTools().aiProfile(TOOL.opencode);

/** An opencode config holding one server a plugin contributed, and the digests it recorded. */
export function contributedOpencodeConfig(): {
  content: string;
  entries: ReadonlyMap<string, string>;
} {
  const mcp = opencode.flatPluginMcp();
  if (mcp === null) throw new Error("opencode answers a flat mcp file");
  const merged = mcp.mergePluginServers(
    null,
    mcp.transform(JSON.stringify({ mcpServers: { srv: { command: "node", args: ["x"] } } })),
    new Map()
  );
  return { content: merged.mergedContent, entries: merged.contributedEntries };
}

export function pluginWithMcp(entries: ReadonlyMap<string, string>): RecordedPlugin {
  return RecordedPlugin.fromMetadata({
    name: "aidd-dev",
    version: "1.0.0",
    source: { kind: "local", path: "/fixture" },
    strict: false,
    scope: "project",
  }).withMcpEntries(entries);
}
