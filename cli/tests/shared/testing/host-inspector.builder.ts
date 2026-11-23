import type { RegisteredCatalog } from "../../../src/composition/contexts/tools.js";
import { CheckMarketplaceSource } from "../../../src/contexts/host-registration/application/check-marketplace-source.use-case.js";
import { InspectHostMarketplaceSources } from "../../../src/contexts/host-registration/application/inspect/inspect-host-marketplace-sources.use-case.js";
import { InspectHostPlugins } from "../../../src/contexts/host-registration/application/inspect/inspect-host-plugins.use-case.js";
import { InspectHostRegistration } from "../../../src/contexts/host-registration/application/inspect/inspect-host-registration.use-case.js";
import { catalogIdentityReader } from "../../../src/contexts/host-registration/infrastructure/marketplace/marketplace-registry-reader.js";
import type { HostMarketplaceRegistry } from "../../../src/contexts/host-registration/ports/host-marketplace-registry.js";
import type { HostPluginRegistry } from "../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";

/** The host registration inspection wired over the catalog's tools, as composition wires it. */
export function hostInspector(
  tools: RegisteredCatalog,
  deps: {
    fs: FileReader;
    pluginRegistries: ReadonlyMap<AiToolId, HostPluginRegistry>;
    marketplaceRegistries: ReadonlyMap<AiToolId, HostMarketplaceRegistry>;
  }
): InspectHostRegistration {
  return new InspectHostRegistration(
    new InspectHostPlugins(deps.pluginRegistries, tools),
    new InspectHostMarketplaceSources(
      catalogIdentityReader(deps.fs),
      new CheckMarketplaceSource(deps.fs, catalogIdentityReader(deps.fs)),
      deps.marketplaceRegistries,
      process.platform,
      tools
    )
  );
}
