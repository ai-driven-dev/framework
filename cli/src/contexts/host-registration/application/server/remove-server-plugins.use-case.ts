import type { ToolId } from "../../../../shared/domain/tool.js";
import { RegistrationRefusedError } from "../../contract/host-registration.error.js";
import type { PluginServerHosts } from "../../ports/server/plugin-server-hosts.js";
import type { ServerPluginLedger } from "../../ports/server/server-plugin-ledger.js";

export interface RemoveServerPluginsDeps {
  readonly hosts: PluginServerHosts;
  readonly ledger: ServerPluginLedger;
}

/**
 * Removes, from each host's own server, the plugins aidd installed there and nothing else. A tool
 * whose binary is gone leaves its plugins standing, so the run is refused and the ledger kept, as
 * a clean refuses a host whose CLI it cannot reach. A removal the host refuses stops the run with
 * the ledger as it was: removing is idempotent, so the retry takes up where it stopped.
 */
export class RemoveServerPlugins {
  constructor(private readonly deps: RemoveServerPluginsDeps) {}

  /** The ids removed, by tool. */
  async execute(): Promise<ReadonlyMap<ToolId, readonly string[]>> {
    const owned = await this.deps.ledger.load();
    const removed = new Map<ToolId, readonly string[]>();
    for (const [toolId, ids] of owned) {
      const host = this.deps.hosts.of(toolId);
      if (host === undefined || ids.length === 0) continue;
      if (!host.server.isAvailable()) {
        throw new RegistrationRefusedError(
          `${host.binary}: ${ids.length} plugin(s) left in place, the ${host.binary} CLI is not on the PATH. User clean refused; the plugins recorded as installed there are kept.`
        );
      }
      await host.server.withSession(async (session) => {
        for (const id of ids) await session.remove(id);
      });
      removed.set(toolId, ids);
    }
    await this.deps.ledger.save(withoutTools(owned, removed.keys()));
    return removed;
  }
}

function withoutTools(
  owned: ReadonlyMap<ToolId, readonly string[]>,
  removed: Iterable<ToolId>
): ReadonlyMap<ToolId, readonly string[]> {
  const kept = new Map(owned);
  for (const toolId of removed) kept.delete(toolId);
  return kept;
}
