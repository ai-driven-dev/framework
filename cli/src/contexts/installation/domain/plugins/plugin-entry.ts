import type { Scope } from "../../../../shared/domain/scope.js";
import type { PluginSource } from "../../../../shared/domain/source.js";

export const PLUGIN_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Branding closes a hole the compiler could not see: three `ReadonlyMap<string, string>` fields
// told apart only by name meant a value meant for one could be assigned to another. The brand is a
// phantom property, so a plain map built anywhere else is still accepted at the factories below.
declare const mapBrand: unique symbol;
type BrandedMap<Name extends string> = ReadonlyMap<string, string> & {
  readonly [mapBrand]: Name;
};

/** relativePath → MD5 hash of the installed file's content. */
export type PathHashMap = BrandedMap<"PathHashMap">;
/** installed relativePath → plugin component path (e.g. rules/01-standards/naming.md). */
export type ComponentPathMap = BrandedMap<"ComponentPathMap">;
/** MCP server name → MD5 hash of the contributed server JSON (OpenCode merge tracking). */
export type McpDigestMap = BrandedMap<"McpDigestMap">;

/** Exact merged Cursor hook commands and copied project scripts recorded at install. */
export interface ProjectHooksProvenance {
  entries: readonly { event: string; command: string; digest: string }[];
  scripts: ReadonlyMap<string, string>;
}

export interface ProjectHooksEntryData {
  entries: { event: string; command: string; digest: string }[];
  scripts: Record<string, string>;
}

export function asPathHashMap(m: ReadonlyMap<string, string>): PathHashMap {
  return m as PathHashMap;
}

export function asComponentPathMap(m: ReadonlyMap<string, string>): ComponentPathMap {
  return m as ComponentPathMap;
}

export function asMcpDigestMap(m: ReadonlyMap<string, string>): McpDigestMap {
  return m as McpDigestMap;
}

export interface PluginEntryData {
  name: string;
  source: Record<string, unknown>;
  version: string;
  strict: boolean;
  files: Record<string, string>;
  /** What `files` is relative to. Mandatory: a default here would guess exactly what
   * this field exists to stop guessing. */
  scope: Scope;
  componentPaths?: Record<string, string>;
  mcpEntries?: Record<string, string>;
  projectHooks?: ProjectHooksEntryData;
  marketplace?: string;
  /** Canonical project roots using machine-owned user-scope files. Only the user manifest owns this list. */
  dependents?: string[];
}

/** What an installed plugin is made of, so a changed copy spreads one plugin into another. */
export interface PluginFields {
  name: string;
  source: PluginSource;
  version: string;
  strict: boolean;
  files: PathHashMap;
  scope: Scope;
  componentPaths: ComponentPathMap;
  mcpEntries: McpDigestMap;
  projectHooks?: ProjectHooksProvenance;
  marketplace?: string;
  dependents: readonly string[];
}
