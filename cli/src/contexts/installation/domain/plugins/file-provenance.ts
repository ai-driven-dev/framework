import type { ComponentPathMap, McpDigestMap, ProjectHooksProvenance } from "./plugin-entry.js";

/** What the translation wrote on a plugin's behalf beyond its own files: the component each
 * installed path came from, and the merged MCP servers and hook entries it owns by key. A
 * removal takes back exactly these, and nothing a person added beside them. */
export interface FileProvenance {
  readonly componentPaths: ComponentPathMap;
  readonly mcpEntries: McpDigestMap;
  readonly projectHooks?: ProjectHooksProvenance;
}
