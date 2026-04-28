export type PluginsMode = "native" | "flat" | "unsupported";

const DEFAULT_MCP_PATH = ".mcp.json";
const DEFAULT_HOOKS_PATH = "hooks/hooks.json";

export interface NativePluginsParams {
  mode: "native";
  pluginsDir: string;
  pluginManifestRelativePath: string;
  mcpRelativePath?: string;
  hooksRelativePath?: string;
  acceptsHooks?: boolean;
  acceptsMcp?: boolean;
}

export interface FlatPluginsParams {
  mode: "flat";
  flatNamespacePrefix: string;
}

export interface UnsupportedPluginsParams {
  mode: "unsupported";
}

type PluginsParams = NativePluginsParams | FlatPluginsParams | UnsupportedPluginsParams;

export class PluginsCapability {
  readonly mode: PluginsMode;
  readonly pluginsDir: string | null;
  readonly pluginManifestRelativePath: string | null;
  readonly flatNamespacePrefix: string | null;
  readonly acceptsHooks: boolean;
  readonly acceptsMcp: boolean;
  readonly mcpRelativePath: string;
  readonly hooksRelativePath: string;

  constructor(params: PluginsParams) {
    this.mode = params.mode;
    if (params.mode === "native") {
      this.pluginsDir = params.pluginsDir;
      this.pluginManifestRelativePath = params.pluginManifestRelativePath;
      this.flatNamespacePrefix = null;
      this.acceptsHooks = params.acceptsHooks ?? false;
      this.acceptsMcp = params.acceptsMcp ?? false;
      this.mcpRelativePath = params.mcpRelativePath ?? DEFAULT_MCP_PATH;
      this.hooksRelativePath = params.hooksRelativePath ?? DEFAULT_HOOKS_PATH;
    } else {
      this.pluginsDir = null;
      this.pluginManifestRelativePath = null;
      this.flatNamespacePrefix = params.mode === "flat" ? params.flatNamespacePrefix : null;
      this.acceptsHooks = false;
      this.acceptsMcp = false;
      this.mcpRelativePath = DEFAULT_MCP_PATH;
      this.hooksRelativePath = DEFAULT_HOOKS_PATH;
    }
  }

  pluginOutputDir(pluginName: string): string | null {
    if (this.mode !== "native" || this.pluginsDir === null) return null;
    return `${this.pluginsDir}${pluginName}/`;
  }
}
