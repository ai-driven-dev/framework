import type { PluginTranslationMode } from "../../contract/tool-vocabulary.js";

/** What a native tool's plugin directory holds beside the plugin's files. */
export interface ManifestSection {
  /** The manifest file relative to the plugin directory, or null when the tool takes none. */
  readonly manifestRelativePath: string | null;
  /** The variable a hook or mcp manifest names the plugin root by. */
  readonly pluginRootToken: string;
  /** `"marketplace"` routes the plugin as a marketplace; null is neutral native. */
  readonly translationMode: PluginTranslationMode | null;
}

export interface ManifestParams {
  manifestRelativePath: string | null;
  pluginRootToken: string;
  translationMode?: PluginTranslationMode;
}

export function manifestSection(params: ManifestParams): ManifestSection {
  return {
    manifestRelativePath: params.manifestRelativePath,
    pluginRootToken: params.pluginRootToken,
    translationMode: params.translationMode ?? null,
  };
}
