import type { BuiltMarketplaceEnsurer } from "../../contract/built-marketplace.js";
import type { InstallationMarketplaceRegistry } from "../../ports/marketplace-sources.js";
import type { PluginTranslation } from "../../ports/plugin/plugin-translation.js";
import type { PluginTranslator } from "../materialize/plugin-translator.js";

/** What re-materializing a plugin needs beyond its files: the build pipeline, to match what
 * install wrote, and the translation, for a source that has no built tree. */
export interface BuiltBuildDeps {
  ensureBuilt: BuiltMarketplaceEnsurer;
  marketplaceRegistry: InstallationMarketplaceRegistry;
  homedir: () => string;
  translate: PluginTranslation;
  /** The platform whose path rules spell a built file's relative path. */
  platform: string;
}

/** The translators composition built: a materializing tool copies the built tree, the others
 * register their marketplace without writing files. */
export interface PluginTranslators {
  readonly builtTree: PluginTranslator;
  readonly marketplace: PluginTranslator;
}

export interface BuiltMaterializationDeps extends BuiltBuildDeps {
  translators: PluginTranslators;
}
