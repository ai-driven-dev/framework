/** Path to the source (Claude-format) plugin manifest inside each plugin directory. */
export const SOURCE_PLUGIN_MANIFEST_RELATIVE = ".claude-plugin/plugin.json";

/** Path to the source (Claude-format) marketplace catalog. */
export const SOURCE_MARKETPLACE_RELATIVE = ".claude-plugin/marketplace.json";

/** Where a plugin keeps the adapter between its hooks and the host: Claude Code's, as shipped,
 * which a build for another tool replaces with that tool's. */
export const HOST_ADAPTER_PATH = "hooks/lib/host.cjs";

export const shipsHostAdapter = (hooks: readonly { readonly relativePath: string }[]): boolean =>
  hooks.some(({ relativePath }) => relativePath === HOST_ADAPTER_PATH);

/** Where a plugin declares its MCP servers, relative to the plugin. */
export const PLUGIN_MCP_RELATIVE = ".mcp.json";
