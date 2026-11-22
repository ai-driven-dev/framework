import { homedir as nodeHomedir, platform as nodePlatform } from "node:os";
import type { EnsurePluginRuntimeFiles } from "../../../../src/contexts/installation/application/install/config/ensure-plugin-runtime-files.use-case.js";
import { PlacePlugin } from "../../../../src/contexts/installation/application/plugin/add/place-plugin.use-case.js";
import { ResolveAddedPluginSource } from "../../../../src/contexts/installation/application/plugin/add/resolve-added-plugin-source.use-case.js";
import {
  AddPlugin,
  type AddPluginManifests,
} from "../../../../src/contexts/installation/application/plugin/add-plugin.use-case.js";
import { AddPluginToProject } from "../../../../src/contexts/installation/application/plugin/add-plugin-to-project.use-case.js";
import type { BuiltMarketplaceEnsurer } from "../../../../src/contexts/installation/contract/built-marketplace.js";
import type { InstallationMarketplaceRegistry } from "../../../../src/contexts/installation/ports/marketplace-sources.js";
import type { LoadDistribution } from "../../../../src/contexts/installation/ports/plugin/load-plugin-distribution.js";
import type { PluginTranslation } from "../../../../src/contexts/installation/ports/plugin/plugin-translation.js";
import { userScopeOwnership } from "../../../../src/contexts/machine-claims/application/ownership/user-scope-ownership.js";
import type { ToolCatalog } from "../../../../src/contexts/tools/contract/tool-catalog.js";
import type { FileReader } from "../../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../../src/shared/ports/file-writer.js";
import type { Logger } from "../../../../src/shared/ports/logger.js";
import { fakeBuiltDeps } from "./fake-build-sources.fake.js";

/** What an AddPlugin writes through and reports with. */
interface AddPluginHost {
  fs: FileWriter & FileReader;
  logger: Logger;
}

/** Where a plugin's files come from. */
export interface AddPluginSources {
  loadDistribution: LoadDistribution;
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
  pluginRuntime?: Pick<EnsurePluginRuntimeFiles, "execute">
): AddPlugin {
  const built = fakeBuiltDeps(host.fs, {
    homedir: nodeHomedir,
    ensureBuilt: sources.ensureBuilt,
    marketplaceRegistry: sources.marketplaceRegistry,
    translate: sources.translate,
    platform: nodePlatform(),
  });
  return new AddPlugin(
    {
      ownership: userScopeOwnership(host.fs),
      manifests,
      addToProject: new AddPluginToProject(
        {
          fs: host.fs,
          source: new ResolveAddedPluginSource(
            { loadDistribution: sources.loadDistribution, fs: host.fs, built },
            tools
          ),
          place: new PlacePlugin({ fs: host.fs, logger: host.logger, built, pluginRuntime }, tools),
        },
        tools
      ),
    },
    tools
  );
}
