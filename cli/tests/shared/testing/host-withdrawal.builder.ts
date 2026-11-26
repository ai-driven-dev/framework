import { hostPortsOver } from "../../../src/contexts/host-registration/application/host-ports-over.js";
import { WithdrawFromHost } from "../../../src/contexts/host-registration/application/withdraw/withdraw-from-host.use-case.js";
import type {
  ProveMarketplaceRemovalRequest,
  ProvenMarketplaceRemoval,
} from "../../../src/contexts/host-registration/application/withdraw/withdrawal.js";
import type { HostActions } from "../../../src/contexts/host-registration/ports/host-actions.js";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { CapturingLogger } from "./capturing-logger.fake.js";
import { InMemoryFileAdapter } from "./in-memory-file-adapter.fake.js";

/** A host withdrawal reaching a host through the given activators, plugin registries and sources. */
export function hostWithdrawal(
  activators: ReadonlyMap<string, HostActions>,
  pluginRegistries: ReadonlyMap<AiToolId, HostPluginRegistry> = new Map(),
  sources: ReadonlyMap<AiToolId, HostMarketplaceSources> = new Map()
): WithdrawFromHost {
  return new WithdrawFromHost(
    new InMemoryFileAdapter(),
    new CapturingLogger(),
    hostPortsOver({
      activators,
      pluginRegistries,
      marketplaceRegistries: new Map(),
      sources,
    })
  );
}

/** Proves a catalogue removable through `host`, as a removal does before it acts. */
export function proveMarketplaceRemoval(
  host: WithdrawFromHost,
  tool: ProveMarketplaceRemovalRequest["tool"],
  registrations: ProveMarketplaceRemovalRequest["registrations"],
  rest: Omit<ProveMarketplaceRemovalRequest, "kind" | "tool" | "registrations">
): Promise<ProvenMarketplaceRemoval> {
  return host.execute({ kind: "prove-marketplace-removal", tool, registrations, ...rest });
}
