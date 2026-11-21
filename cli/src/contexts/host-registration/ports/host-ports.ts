import type { AiToolId } from "../../../shared/domain/tool.js";
import type { HostActions } from "./host-actions.js";
import type { HostMarketplaceRegistry } from "./host-marketplace-registry.js";
import type { HostMarketplaceSources } from "./host-marketplace-sources.js";
import type { HostPluginRegistry } from "./host-plugin-registry.js";

/** Everything the host registration reaches a host through, assembled once by composition so a
 * use case takes one dependency where it would take four maps. */
export interface HostPorts {
  /** Native plugin CLI activators keyed by `NativeActivation.hostBinary()`. */
  readonly activators: ReadonlyMap<string, HostActions>;
  /** Host plugin registry readers, consulted so the scope asked for is the one the host holds. */
  readonly pluginRegistries: ReadonlyMap<AiToolId, HostPluginRegistry>;
  /** Readers of a host's own marketplace registry; absent for a tool that declares none. */
  readonly marketplaceRegistries: ReadonlyMap<AiToolId, HostMarketplaceRegistry>;
  readonly sources: ReadonlyMap<AiToolId, HostMarketplaceSources>;
}
