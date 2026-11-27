import { errorMessage } from "../../../../../shared/domain/describe-error.js";
import { McpConfigError } from "../../../../../shared/domain/shared.error.js";
import { InvalidMcpServerConfigError } from "../../../contract/errors/tools.error.js";

type RawServer =
  | { command: string; args?: string[]; env?: Record<string, string>; disabled?: boolean }
  | { url: string; disabled?: boolean };

interface TypedLocalServer {
  type: "local";
  command: string[];
  enabled: boolean;
  environment?: Record<string, string>;
}

interface TypedRemoteServer {
  type: "remote";
  url: string;
  enabled: boolean;
}

type TypedServer = TypedLocalServer | TypedRemoteServer;

function convertRawServer(name: string, server: RawServer): TypedServer {
  const enabled = server.disabled !== true;
  if ("command" in server) {
    const { command, args = [], env } = server;
    const local: TypedLocalServer = { type: "local", command: [command, ...args], enabled };
    if (env && Object.keys(env).length > 0) local.environment = env;
    return local;
  }
  if ("url" in server) {
    return { type: "remote", url: server.url, enabled };
  }
  throw new InvalidMcpServerConfigError(name);
}

function typedServers(content: string): Record<string, TypedServer> {
  let parsed: { mcpServers?: Record<string, RawServer> };
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new McpConfigError(`Cannot parse MCP config: ${errorMessage(err)}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new McpConfigError("MCP config must be a JSON object");
  }
  const mcp: Record<string, TypedServer> = {};
  for (const [name, server] of Object.entries(parsed.mcpServers ?? {})) {
    mcp[name] = convertRawServer(name, server);
  }
  return mcp;
}

export function toTypedMcpSection(content: string): string {
  return JSON.stringify({ mcp: typedServers(content) }, null, 2);
}

/** The typed servers of every built plugin that ships an mcp file, a later plugin overriding an
 * earlier one of the same name. */
export function collectTypedMcp(
  builtPlugins: readonly string[],
  pluginMcp: ReadonlyMap<string, string>
): Record<string, unknown> {
  const incoming: Record<string, unknown> = {};
  for (const plugin of builtPlugins) {
    const raw = pluginMcp.get(plugin);
    if (raw === undefined) continue;
    Object.assign(incoming, typedServers(raw));
  }
  return incoming;
}
