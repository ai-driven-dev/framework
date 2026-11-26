import type { ToolId } from "../../../../shared/domain/tool.js";
import { RegistrationRefusedError } from "../../contract/host-registration.error.js";
import { binaryAbsentNotice } from "../../domain/binary-absent.js";
import type { PluginServerHosts, ServerHost } from "../../ports/server/plugin-server-hosts.js";
import type { ServerPluginLedger } from "../../ports/server/server-plugin-ledger.js";

export interface RemoveServerPluginsDeps {
  readonly hosts: PluginServerHosts;
  readonly ledger: ServerPluginLedger;
}

export interface RemoveServerPluginRequest {
  readonly plugin: string;
  readonly toolIds: readonly ToolId[] | "all";
}

type Owned = ReadonlyMap<ToolId, readonly string[]>;

/**
 * Removes, from each host's own server, the plugins aidd installed there and nothing else. A tool
 * whose binary is gone leaves its plugins standing, so the run is refused and the ledger kept, as
 * a clean refuses a host whose CLI it cannot reach. A removal the host refuses stops the run with
 * the ledger as it was: removing is idempotent, so the retry takes up where it stopped.
 */
export class RemoveServerPlugins {
  constructor(private readonly deps: RemoveServerPluginsDeps) {}

  /** The ids removed, by tool: every plugin aidd owns, or only the one asked for, from the tools
   * asked for. */
  execute(only?: RemoveServerPluginRequest): Promise<Owned> {
    return this.removeWhere((toolId, ids) => {
      if (only === undefined) return ids;
      const asked = only.toolIds === "all" || only.toolIds.includes(toolId);
      return asked && ids.includes(only.plugin) ? [only.plugin] : [];
    });
  }

  private async removeWhere(
    selected: (toolId: ToolId, owned: readonly string[]) => readonly string[]
  ): Promise<Owned> {
    const owned = await this.deps.ledger.load();
    const removed = new Map<ToolId, readonly string[]>();
    const kept = new Map(owned);
    for (const [toolId, ids] of owned) {
      const gone = selected(toolId, ids);
      const host = this.deps.hosts.of(toolId);
      if (host === undefined || gone.length === 0) continue;
      await this.removeFrom(host, gone);
      removed.set(toolId, gone);
      const rest = ids.filter((id) => !gone.includes(id));
      if (rest.length === 0) kept.delete(toolId);
      else kept.set(toolId, rest);
    }
    await this.deps.ledger.save(kept);
    return removed;
  }

  private async removeFrom(host: ServerHost, ids: readonly string[]): Promise<void> {
    if (!host.server.isAvailable()) {
      throw new RegistrationRefusedError(
        `${binaryAbsentNotice(host.binary, `${ids.length} plugin(s)`)} User clean refused; the plugins recorded as installed there are kept.`
      );
    }
    await host.server.withSession(async (session) => {
      for (const id of ids) await session.remove(id);
    });
  }
}
