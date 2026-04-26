import { stringify } from "smol-toml";
import type { FileSystem } from "../ports/file-system.js";

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

function buildStdioTomlEntry(raw: StdioServer & Record<string, unknown>): Record<string, unknown> {
  const entry: Record<string, unknown> = { command: raw.command };
  if (raw.args !== undefined) entry.args = raw.args;
  if (raw.env !== undefined) entry.env = raw.env;
  if (raw.cwd !== undefined) entry.cwd = raw.cwd;
  for (const field of UNIVERSAL_FIELDS) {
    if (raw[field] !== undefined) entry[field] = raw[field];
  }
  return entry;
}

function buildHttpTomlEntry(raw: HttpServer & Record<string, unknown>): Record<string, unknown> {
  const entry: Record<string, unknown> = { url: raw.url };
  if (raw.bearerTokenEnvVar !== undefined) entry.bearer_token_env_var = raw.bearerTokenEnvVar;
  if (raw.http_headers !== undefined) entry.http_headers = raw.http_headers;
  if (raw.env_http_headers !== undefined) entry.env_http_headers = raw.env_http_headers;
  for (const field of UNIVERSAL_FIELDS) {
    if (raw[field] !== undefined) entry[field] = raw[field];
  }
  return entry;
}

function mapServerToToml(raw: Record<string, unknown>): Record<string, unknown> {
  if ("command" in raw) return buildStdioTomlEntry(raw as StdioServer & Record<string, unknown>);
  if ("url" in raw) return buildHttpTomlEntry(raw as HttpServer & Record<string, unknown>);
  return {};
}

export function mcpJsonToToml(json: string): string {
  const parsed = JSON.parse(json) as { mcpServers?: Record<string, Record<string, unknown>> };
  const servers = parsed.mcpServers ?? {};
  if (Object.keys(servers).length === 0) return "";
  const mcp_servers: Record<string, unknown> = {};
  for (const [name, raw] of Object.entries(servers)) {
    mcp_servers[name] = mapServerToToml(raw);
  }
  return stringify({ mcp_servers });
}

function mergeJsonUserPrime(existing: string, incoming: string): string {
  const existingObj = existing.trim() ? (JSON.parse(existing) as Record<string, unknown>) : {};
  const incomingObj = JSON.parse(incoming) as Record<string, unknown>;
  const merged = deepMerge(incomingObj, existingObj);
  return JSON.stringify(merged, null, 2);
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const existing = result[key];
    if (isPlainObject(value) && isPlainObject(existing)) {
      result[key] = deepMerge(
        existing as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

function isPlainObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class McpCapability {
  readonly consumes: readonly string[];

  constructor(
    readonly params: {
      outputPath: string;
      format: "json" | "toml";
      entrySection?: string;
      mergeStrategy?: "user-prime" | "framework-prime" | "none";
      mergeFn?: (existing: string, incoming: string) => string;
      transformContent?: (content: string) => string;
      resolveOutputPath?: (projectRoot: string, fs: FileSystem) => Promise<string>;
      consumes?: readonly string[];
    }
  ) {
    this.consumes = params.consumes ?? [];
  }

  transform(mcpJson: string): string {
    const afterTransform = this.params.transformContent
      ? this.params.transformContent(mcpJson)
      : mcpJson;
    if (this.params.format === "toml") {
      return mcpJsonToToml(afterTransform);
    }
    return afterTransform;
  }

  async resolveOutput(projectRoot: string, fs: FileSystem): Promise<string> {
    if (this.params.resolveOutputPath) {
      return this.params.resolveOutputPath(projectRoot, fs);
    }
    return this.params.outputPath;
  }

  merge(existing: string, incoming: string): string {
    if (this.params.mergeFn !== undefined) {
      return this.params.mergeFn(existing, incoming);
    }
    if (this.params.mergeStrategy === "none") {
      return incoming;
    }
    return mergeJsonUserPrime(existing, incoming);
  }

  accepts(relativePath: string): boolean {
    return relativePath === this.params.outputPath;
  }

  equals(other: McpCapability): boolean {
    return (
      this.params.outputPath === other.params.outputPath &&
      this.params.format === other.params.format &&
      this.params.entrySection === other.params.entrySection &&
      this.params.mergeStrategy === other.params.mergeStrategy
    );
  }
}
