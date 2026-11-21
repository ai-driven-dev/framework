import { homedir as nodeHomedir, platform as nodePlatform } from "node:os";
import type { InstallRuntimeConfig } from "../../../../src/contexts/installation/application/install/config/install-runtime-config.js";
import { PlacePlugin } from "../../../../src/contexts/installation/application/plugin/add/place-plugin.js";
import { ResolveAddedPluginSource } from "../../../../src/contexts/installation/application/plugin/add/resolve-added-plugin-source.js";
import {
  AddPlugin,
  type AddPluginManifests,
} from "../../../../src/contexts/installation/application/plugin/add-plugin.js";
import type { PluginDistributionLoader } from "../../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import type { BuiltMarketplaceEnsurer } from "../../../../src/contexts/installation/contract/built-marketplace.js";
import type { InstallationMarketplaceRegistry } from "../../../../src/contexts/installation/ports/marketplace-sources.js";
import type { PluginTranslation } from "../../../../src/contexts/installation/ports/plugin/plugin-translation.js";
import type { ToolCatalog } from "../../../../src/contexts/tools/contract/tool-catalog.js";
import type { FileReader } from "../../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../../src/shared/ports/file-writer.js";
import type { Logger } from "../../../../src/shared/ports/logger.js";

/** What an AddPlugin writes through and reports with. */
interface AddPluginHost {
  fs: FileWriter & FileReader;
  logger: Logger;
}

/** Where a plugin's files come from. */
export interface AddPluginSources {
  distributionLoader: PluginDistributionLoader;
  marketplaceRegistry: InstallationMarketplaceRegistry;
  ensureBuilt: BuiltMarketplaceEnsurer;
  translate: PluginTranslation;
}

/** An AddPlugin wired the way the composition wires it, over the sources a test supplies. */
export function buildAddPlugin(
  host: AddPluginHost,
  manifests: AddPluginManifests,
  sources: AddPluginSources,
  tools: ToolCatalog,
  pluginRuntime?: Pick<InstallRuntimeConfig, "ensurePluginRuntimeFiles">
): AddPlugin {
  const built = {
    homedir: nodeHomedir,
    ensureBuilt: sources.ensureBuilt,
    marketplaceRegistry: sources.marketplaceRegistry,
    translate: sources.translate,
    platform: nodePlatform(),
  };
  return new AddPlugin(
    host.fs,
    manifests,
    new ResolveAddedPluginSource(
      { distributionLoader: sources.distributionLoader, fs: host.fs, built },
      tools
    ),
    new PlacePlugin({ fs: host.fs, logger: host.logger, built, pluginRuntime }, tools),
    tools
  );
}
