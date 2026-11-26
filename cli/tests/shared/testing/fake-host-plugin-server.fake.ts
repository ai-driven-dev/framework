import { basename } from "node:path";
import { RegistrationRefusedError } from "../../../src/contexts/host-registration/contract/host-registration.error.js";
import type { ServerPlugin } from "../../../src/contexts/host-registration/domain/server/server-plugin.js";
import type { HostPluginServer } from "../../../src/contexts/host-registration/ports/server/host-plugin-server.js";
import type { PluginServerSession } from "../../../src/contexts/host-registration/ports/server/plugin-server-session.js";

/** Holds plugins in memory instead of starting a host's server. A plugin's id is its directory's
 * name, which is what a host's own manifest would name in the cases a test builds. */
export class FakeHostPluginServer implements HostPluginServer {
  available: boolean;
  /** Every plugin held, by id. Seed it to give the host plugins no run installed. */
  readonly held = new Map<string, ServerPlugin>();
  /** The directories installed, in call order. */
  readonly installedFrom: string[] = [];
  /** The ids removed, in call order. */
  readonly removed: string[] = [];
  sessionsOpened = 0;
  sessionsClosed = 0;
  private readonly refusing: boolean;
  private readonly unhealthy: ReadonlySet<string>;

  constructor(
    options: { available?: boolean; refusing?: boolean; unhealthy?: readonly string[] } = {}
  ) {
    this.available = options.available ?? true;
    this.refusing = options.refusing ?? false;
    this.unhealthy = new Set(options.unhealthy);
  }

  isAvailable(): boolean {
    return this.available;
  }

  async withSession<T>(use: (session: PluginServerSession) => Promise<T>): Promise<T> {
    this.sessionsOpened += 1;
    try {
      return await use(this.session());
    } finally {
      this.sessionsClosed += 1;
    }
  }

  private session(): PluginServerSession {
    return {
      list: async () => [...this.held.values()],
      install: async (directory) => {
        if (this.refusing) return { refusal: { detail: `install ${directory} refused` } };
        this.installedFrom.push(directory);
        const id = basename(directory);
        const plugin = { id, originalSource: directory, healthy: !this.unhealthy.has(id) };
        this.held.set(plugin.id, plugin);
        return { plugin };
      },
      remove: async (id) => {
        if (this.refusing) throw new RegistrationRefusedError(`remove ${id} refused`);
        this.removed.push(id);
        this.held.delete(id);
      },
    };
  }
}
