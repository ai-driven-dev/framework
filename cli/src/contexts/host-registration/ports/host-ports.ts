import type { AiToolId } from "../../../shared/domain/tool.js";
import type { HostActions } from "./host-actions.js";
import type { HostMarketplaceRegistry } from "./host-marketplace-registry.js";
import type { HostMarketplaceSources } from "./host-marketplace-sources.js";
import type { HostPluginRegistry } from "./host-plugin-registry.js";

/** Everything the host registration reaches a host through, assembled once by composition so a
 * use case takes one dependency where it would take four maps. Each answer is `undefined` when
 * nothing is wired for that binary or tool. */
export interface HostPorts {
  /** The native plugin CLI activator serving `NativeActivation.hostBinary()`. */
  activator(binary: string): HostActions | undefined;
  /** That activator only when it is on the PATH. */
  reachableActivator(binary: string | undefined): HostActions | undefined;
  /** The host's plugin registry reader, consulted so the scope asked for is the one it holds. */
  pluginRegistry(tool: AiToolId): HostPluginRegistry | undefined;
  /** The reader of a host's own marketplace registry; absent for a tool that declares none. */
  marketplaceRegistry(tool: AiToolId): HostMarketplaceRegistry | undefined;
  sources(tool: AiToolId): HostMarketplaceSources | undefined;
}

/** The maps composition wires the host ports from. */
export interface HostPortMaps {
  /** Keyed by `NativeActivation.hostBinary()`. */
  readonly activators: ReadonlyMap<string, HostActions>;
  readonly pluginRegistries: ReadonlyMap<AiToolId, HostPluginRegistry>;
  readonly marketplaceRegistries: ReadonlyMap<AiToolId, HostMarketplaceRegistry>;
  readonly sources: ReadonlyMap<AiToolId, HostMarketplaceSources>;
}
