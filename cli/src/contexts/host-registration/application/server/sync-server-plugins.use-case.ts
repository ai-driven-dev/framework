import { join } from "node:path";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { ServerPlugin } from "../../domain/server/server-plugin.js";
import type { PluginServerHosts } from "../../ports/server/plugin-server-hosts.js";
import type { PluginServerSession } from "../../ports/server/plugin-server-session.js";
import type { ServerPluginLedger } from "../../ports/server/server-plugin-ledger.js";

export interface SyncServerPluginsRequest {
  readonly toolId: ToolId;
  /** The built marketplace tree, whose `plugins/<name>` hold what the host installs, `null` when
   * it could not be built. Asked for only once a host is there to take it. */
  readonly builtDir: () => Promise<string | null>;
  /** The plugins this run asks for. Those aidd already installed are installed again with them. */
  readonly names: readonly string[];
}

export type SyncServerPluginsResult =
  | { readonly status: "unconfigured" }
  | { readonly status: "binary-missing"; readonly binary: string }
  | { readonly status: "unbuilt" }
  | {
      readonly status: "installed";
      readonly installed: readonly string[];
      /** What a person must know: a plugin left alone, refused or loaded with errors. */
      readonly problems: readonly string[];
    };

export interface SyncServerPluginsDeps {
  readonly hosts: PluginServerHosts;
  readonly ledger: ServerPluginLedger;
}

/**
 * Has a host that takes plugins through its own server install them from the built tree, and
 * records which ones are aidd's. A plugin the server holds from another source and aidd never
 * installed is left as it is: the server keys plugins by id alone, and installing over it would
 * replace a person's own. Each plugin is best-effort, so one refusal never stops the others.
 */
export class SyncServerPlugins {
  constructor(private readonly deps: SyncServerPluginsDeps) {}

  async execute(request: SyncServerPluginsRequest): Promise<SyncServerPluginsResult> {
    const host = this.deps.hosts.of(request.toolId);
    if (host === undefined) return { status: "unconfigured" };
    if (!host.server.isAvailable()) return { status: "binary-missing", binary: host.binary };
    const owned = (await this.deps.ledger.load()).get(request.toolId) ?? [];
    const names = [...new Set([...request.names, ...owned])];
    if (names.length === 0) return { status: "installed", installed: [], problems: [] };
    const builtDir = await request.builtDir();
    if (builtDir === null) return { status: "unbuilt" };
    const { installed, problems } = await host.server.withSession((session) =>
      installAll(session, { names, owned, builtDir })
    );
    await this.record(request.toolId, [...new Set([...owned, ...installed])]);
    return { status: "installed", installed, problems };
  }

  private async record(toolId: ToolId, owned: readonly string[]): Promise<void> {
    const all = await this.deps.ledger.load();
    if (owned.length === 0) all.delete(toolId);
    else all.set(toolId, owned);
    await this.deps.ledger.save(all);
  }
}

interface Batch {
  readonly names: readonly string[];
  readonly owned: readonly string[];
  readonly builtDir: string;
}

async function installAll(session: PluginServerSession, batch: Batch) {
  const held = await session.list();
  const installed: string[] = [];
  const problems: string[] = [];
  for (const name of batch.names) {
    const directory = join(batch.builtDir, "plugins", name);
    const other = foreignHolder(held, { name, directory, owned: batch.owned });
    if (other !== undefined) {
      problems.push(`'${name}' is already installed from ${other.originalSource}: left as it is.`);
      continue;
    }
    const result = await session.install(directory);
    if ("refusal" in result) {
      problems.push(`'${name}' was not installed: ${result.refusal.detail}`);
      continue;
    }
    installed.push(name);
    if (!result.plugin.healthy) {
      problems.push(`'${name}' was installed but the host loaded it with errors.`);
    }
  }
  return { installed, problems };
}

/** The plugin the host holds under this id from somewhere else, unless aidd put it there. */
function foreignHolder(
  held: readonly ServerPlugin[],
  plugin: { name: string; directory: string; owned: readonly string[] }
): ServerPlugin | undefined {
  const present = held.find(({ id }) => id === plugin.name);
  const ours = plugin.owned.includes(plugin.name) || present?.originalSource === plugin.directory;
  return ours ? undefined : present;
}
