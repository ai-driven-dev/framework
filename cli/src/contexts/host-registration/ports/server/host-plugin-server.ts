import type { PluginServerSession } from "./plugin-server-session.js";

/** A host that takes its plugins through a server it starts on demand. Owning the server's life
 * keeps a caller from leaving one running: it is stopped when `use` settles, however it settles. */
export interface HostPluginServer {
  /** Whether the host's binary is on the PATH. Never throws. */
  isAvailable(): boolean;
  withSession<T>(use: (session: PluginServerSession) => Promise<T>): Promise<T>;
}
