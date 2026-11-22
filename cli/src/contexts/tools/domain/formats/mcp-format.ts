import type { TomlCodec } from "./toml.js";

interface StdioServer {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

interface HttpServer {
  url: string;
  bearerTokenEnvVar?: string;
  http_headers?: Record<string, string>;
  env_http_headers?: Record<string, string>;
}

const UNIVERSAL_FIELDS = [
  "startup_timeout_sec",
  "tool_timeout_sec",
  "enabled",
  "required",
  "enabled_tools",
  "disabled_tools",
] as const;

/** An absent field stays `undefined`; the TOML writer leaves it out. */
function universalFields(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(UNIVERSAL_FIELDS.map((field) => [field, raw[field]]));
}

function buildStdioTomlEntry(raw: StdioServer & Record<string, unknown>): Record<string, unknown> {
  return {
    command: raw.command,
    args: raw.args,
    env: raw.env,
    cwd: raw.cwd,
    ...universalFields(raw),
  };
}

function buildHttpTomlEntry(raw: HttpServer & Record<string, unknown>): Record<string, unknown> {
  return {
    url: raw.url,
    bearer_token_env_var: raw.bearerTokenEnvVar,
    http_headers: raw.http_headers,
    env_http_headers: raw.env_http_headers,
    ...universalFields(raw),
  };
}

function mapServerToToml(raw: Record<string, unknown>): Record<string, unknown> {
  if ("command" in raw) return buildStdioTomlEntry(raw as StdioServer & Record<string, unknown>);
  if ("url" in raw) return buildHttpTomlEntry(raw as HttpServer & Record<string, unknown>);
  return {};
}

export function mcpJsonToToml(toml: TomlCodec, json: string): string {
  const parsed = JSON.parse(json) as { mcpServers?: Record<string, Record<string, unknown>> };
  const servers = parsed.mcpServers ?? {};
  if (Object.keys(servers).length === 0) return "";
  const mcp_servers: Record<string, unknown> = {};
  for (const [name, raw] of Object.entries(servers)) {
    mcp_servers[name] = mapServerToToml(raw);
  }
  return toml.stringify({ mcp_servers });
}

export function mergeJsonUserPrime(existing: string, incoming: string): string {
  const existingObj = existing.trim() ? (JSON.parse(existing) as Record<string, unknown>) : {};
  const incomingObj = JSON.parse(incoming) as Record<string, unknown>;
  return JSON.stringify(deepMerge(incomingObj, existingObj), null, 2);
}

export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const existing = result[key];
    if (isPlainObject(value) && isPlainObject(existing)) {
      result[key] = deepMerge(existing, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface McpServerWin32 {
  command?: string;
  args?: string[];
  [key: string]: unknown;
}

/** The executable a Windows launch runs in place of the one the config names. */
const WIN32_EXECUTABLES: ReadonlyMap<string, string> = new Map([
  ["uvx", "uvx.exe"],
  ["uv", "uv.exe"],
]);

function launchOnWin32(server: McpServerWin32): void {
  if (server.command === "npx") {
    server.args = ["/c", "npx", ...(server.args ?? [])];
    server.command = "cmd";
    return;
  }
  const executable =
    server.command === undefined ? undefined : WIN32_EXECUTABLES.get(server.command);
  if (executable !== undefined) server.command = executable;
}

/** The MCP config with each server's launch rewritten to run on Windows. */
export function transformMcpForWin32(content: string): string {
  const config = JSON.parse(content);
  if (!config.mcpServers) return JSON.stringify(config, null, 2);
  for (const server of Object.values<McpServerWin32>(config.mcpServers)) launchOnWin32(server);
  return JSON.stringify(config, null, 2);
}
