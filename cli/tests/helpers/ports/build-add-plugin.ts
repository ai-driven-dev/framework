import type { InstallRuntimeConfig } from "../../../src/contexts/installation/application/install/config/install-runtime-config.js";
import { PlacePlugin } from "../../../src/contexts/installation/application/plugin/add/place-plugin.js";
import {
  type AddPluginSources,
  ResolveAddedPluginSource,
} from "../../../src/contexts/installation/application/plugin/add/resolve-plugin-source.js";
import {
  AddPlugin,
  type AddPluginManifests,
} from "../../../src/contexts/installation/application/plugin/add-plugin.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../src/shared/ports/file-writer.js";
import type { Logger } from "../../../src/shared/ports/logger.js";

/** What an AddPlugin writes through and reports with. */
interface AddPluginHost {
  fs: FileWriter & FileReader;
  logger: Logger;
}

/** An AddPlugin wired the way the composition wires it, over the sources a test supplies. */
export function buildAddPlugin(
  host: AddPluginHost,
  manifests: AddPluginManifests,
  sources: AddPluginSources,
  tools: ToolCatalog,
  pluginRuntime?: Pick<InstallRuntimeConfig, "ensurePluginRuntimeFiles">
): AddPlugin {
  const source = new ResolveAddedPluginSource(sources);
  return new AddPlugin(
    host.fs,
    manifests,
    source,
    new PlacePlugin(host.fs, host.logger, source, tools, pluginRuntime),
    tools
  );
}
