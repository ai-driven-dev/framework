/** What a native tool's plugin directory holds beside the plugin's files. */
export interface ManifestSection {
  /** The manifest file relative to the plugin directory, or null when the tool takes none. */
  readonly manifestRelativePath: string | null;
  /** The variable a hook or mcp manifest names the plugin root by. */
  readonly pluginRootToken: string;
}

export interface ManifestParams {
  manifestRelativePath: string | null;
  pluginRootToken: string;
}

export function manifestSection(params: ManifestParams): ManifestSection {
  return {
    manifestRelativePath: params.manifestRelativePath,
    pluginRootToken: params.pluginRootToken,
  };
}
