import type { ToolId } from "../../../../shared/domain/tool.js";
import type { HostPluginServer } from "./host-plugin-server.js";

/** A host's plugin server with the name of the binary that starts it. */
export interface ServerHost {
  readonly binary: string;
  readonly server: HostPluginServer;
}

export interface PluginServerHosts {
  /** `undefined` for a tool that declares none. */
  of(toolId: ToolId): ServerHost | undefined;
}
