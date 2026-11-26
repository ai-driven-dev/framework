import type { ServerInstallation, ServerPlugin } from "../../domain/server/server-plugin.js";

/** What a host's own plugin server does while it runs. A refused listing or removal throws a
 * `RegistrationRefusedError` naming what the host said; a refused install is returned. */
export interface PluginServerSession {
  /** Every plugin the host holds, whoever installed it. */
  list(): Promise<readonly ServerPlugin[]>;
  /** Installs, or replaces, the plugin in a local directory. The host copies the tree. */
  install(directory: string): Promise<ServerInstallation>;
  /** Removes a plugin by id; one the host does not hold is already removed. */
  remove(id: string): Promise<void>;
}
