/** Path to the source (Claude-format) plugin manifest inside each plugin directory. */
export const SOURCE_PLUGIN_MANIFEST_RELATIVE = ".claude-plugin/plugin.json";

/** Path to the source (Claude-format) marketplace catalog. */
export const SOURCE_MARKETPLACE_RELATIVE = ".claude-plugin/marketplace.json";

/** Where a plugin keeps the adapter between its hooks and the host: Claude Code's, as shipped,
 * which a build for another tool replaces with that tool's. */
export const HOST_ADAPTER_PATH = "hooks/lib/host.cjs";

export const shipsHostAdapter = (hooks: readonly { readonly relativePath: string }[]): boolean =>
  hooks.some(({ relativePath }) => relativePath === HOST_ADAPTER_PATH);

/** The one plugin whose hooks run the release of held answers, so it runs once per model call
 * whatever the route. A source without it, such as a third-party marketplace, holds answers
 * nothing releases. */
export const RELEASE_OWNER_PLUGIN = "aidd-context";

export const carriesRelease = (
  plugin: string,
  hooks: readonly { readonly relativePath: string }[]
): boolean => plugin === RELEASE_OWNER_PLUGIN && shipsHostAdapter(hooks);

/** Where a plugin declares its MCP servers, relative to the plugin. */
export const PLUGIN_MCP_RELATIVE = ".mcp.json";
