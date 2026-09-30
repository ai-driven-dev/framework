import {
  InvalidPluginNameError,
  InvalidPluginVersionError,
  MalformedPluginScopeError,
} from "../../../../kernel/errors.js";
import type { InstallationFile } from "../../../../kernel/file.js";
import { isSemver } from "../../../../kernel/semver.js";
import {
  type PluginSource,
  parsePluginSource,
  serializePluginSource,
} from "../../../../kernel/source.js";
import type { PluginDistribution } from "../../../translate/domain/plugin-distribution.js";
import { type InstallScope, isInstallScope } from "../install-scope.js";

export const PLUGIN_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** What a plugin's `files` keys are relative to: the project root, or the tool's user-scope plugins
 * directory. Recorded once, at install, and never re-derived from a tool's current profile, which
 * can disagree with what was true when the entry was written. */
export type PluginScope = InstallScope;

export function parsePluginSpec(arg: string): { name: string; version?: string } {
  const at = arg.lastIndexOf("@");
  if (at <= 0) return { name: arg };
  return { name: arg.slice(0, at), version: arg.slice(at + 1) };
}

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

interface ProjectHooksEntryData {
  entries: { event: string; command: string; digest: string }[];
  scripts: Record<string, string>;
}

function asPathHashMap(m: ReadonlyMap<string, string>): PathHashMap {
  return m as PathHashMap;
}

function asComponentPathMap(m: ReadonlyMap<string, string>): ComponentPathMap {
  return m as ComponentPathMap;
}

function asMcpDigestMap(m: ReadonlyMap<string, string>): McpDigestMap {
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
  scope: PluginScope;
  componentPaths?: Record<string, string>;
  mcpEntries?: Record<string, string>;
  projectHooks?: ProjectHooksEntryData;
  marketplace?: string;
  /** Canonical project roots using machine-owned user-scope files. Only the user manifest owns this list. */
  dependents?: string[];
}

export class InstalledPlugin {
  readonly name: string;
  readonly source: PluginSource;
  readonly version: string;
  readonly strict: boolean;
  readonly files: PathHashMap;
  readonly scope: PluginScope;
  readonly componentPaths: ComponentPathMap;
  readonly mcpEntries: McpDigestMap;
  readonly projectHooks?: ProjectHooksProvenance;
  readonly marketplace?: string;
  readonly dependents: readonly string[];

  private constructor(params: {
    name: string;
    source: PluginSource;
    version: string;
    strict: boolean;
    files: PathHashMap;
    scope: PluginScope;
    componentPaths: ComponentPathMap;
    mcpEntries: McpDigestMap;
    projectHooks?: ProjectHooksProvenance;
    marketplace?: string;
    dependents: readonly string[];
  }) {
    this.name = params.name;
    this.source = params.source;
    this.version = params.version;
    this.strict = params.strict;
    this.files = params.files;
    this.scope = params.scope;
    this.componentPaths = params.componentPaths;
    this.mcpEntries = params.mcpEntries;
    this.projectHooks = params.projectHooks;
    this.marketplace = params.marketplace;
    this.dependents = params.dependents;
  }

  static fromMetadata(
    name: string,
    version: string,
    source: PluginSource,
    strict: boolean,
    scope: PluginScope,
    marketplace?: string
  ): InstalledPlugin {
    const data: PluginEntryData = {
      name,
      source: serializePluginSource(source),
      version,
      strict,
      files: {},
      scope,
    };
    if (marketplace !== undefined) data.marketplace = marketplace;
    return InstalledPlugin.fromJSON(data);
  }

  static withMcpEntries(
    plugin: InstalledPlugin,
    mcpEntries: ReadonlyMap<string, string>
  ): InstalledPlugin {
    return new InstalledPlugin({
      name: plugin.name,
      source: plugin.source,
      version: plugin.version,
      strict: plugin.strict,
      files: plugin.files,
      scope: plugin.scope,
      componentPaths: plugin.componentPaths,
      mcpEntries: asMcpDigestMap(mcpEntries),
      projectHooks: plugin.projectHooks,
      marketplace: plugin.marketplace,
      dependents: plugin.dependents,
    });
  }

  static withProjectHooks(
    plugin: InstalledPlugin,
    projectHooks: ProjectHooksProvenance | undefined
  ): InstalledPlugin {
    return new InstalledPlugin({
      name: plugin.name,
      source: plugin.source,
      version: plugin.version,
      strict: plugin.strict,
      files: plugin.files,
      scope: plugin.scope,
      componentPaths: plugin.componentPaths,
      mcpEntries: plugin.mcpEntries,
      projectHooks,
      marketplace: plugin.marketplace,
      dependents: plugin.dependents,
    });
  }

  static fromDistribution(
    dist: PluginDistribution,
    source: PluginSource,
    files: InstallationFile[],
    scope: PluginScope,
    componentPaths?: ReadonlyMap<string, string>,
    marketplace?: string
  ): InstalledPlugin {
    const filesRecord: Record<string, string> = {};
    for (const f of files) {
      filesRecord[f.relativePath] = f.hash.value;
    }
    const componentPathsRecord: Record<string, string> = {};
    if (componentPaths) {
      for (const [k, v] of componentPaths) componentPathsRecord[k] = v;
    }
    const data: PluginEntryData = {
      name: dist.manifest.name,
      source: serializePluginSource(source),
      version: dist.manifest.version,
      strict: dist.manifest.strict ?? false,
      files: filesRecord,
      scope,
      componentPaths: componentPathsRecord,
    };
    if (marketplace !== undefined) data.marketplace = marketplace;
    return InstalledPlugin.fromJSON(data);
  }

  static fromDistributionWithMcp(
    dist: PluginDistribution,
    source: PluginSource,
    files: InstallationFile[],
    mcpEntries: ReadonlyMap<string, string>,
    scope: PluginScope,
    componentPaths?: ReadonlyMap<string, string>,
    marketplace?: string
  ): InstalledPlugin {
    const base = InstalledPlugin.fromDistribution(
      dist,
      source,
      files,
      scope,
      componentPaths,
      marketplace
    );
    return InstalledPlugin.withMcpEntries(base, mcpEntries);
  }

  static fromJSON(data: PluginEntryData): InstalledPlugin {
    if (!PLUGIN_NAME_REGEX.test(data.name)) {
      throw new InvalidPluginNameError(data.name);
    }
    if (!isSemver(data.version)) {
      throw new InvalidPluginVersionError(data.version);
    }
    if (!isInstallScope(data.scope)) {
      throw new MalformedPluginScopeError(data.name, data.scope);
    }
    const source = parsePluginSource(data.source);
    const files = new Map(Object.entries(data.files));
    const componentPaths = new Map(Object.entries(data.componentPaths ?? {}));
    const mcpEntries = new Map(Object.entries(data.mcpEntries ?? {}));
    return new InstalledPlugin({
      name: data.name,
      source,
      version: data.version,
      strict: data.strict,
      files: asPathHashMap(files),
      scope: data.scope,
      componentPaths: asComponentPathMap(componentPaths),
      mcpEntries: asMcpDigestMap(mcpEntries),
      projectHooks:
        data.projectHooks === undefined
          ? undefined
          : {
              entries: data.projectHooks.entries,
              scripts: new Map(Object.entries(data.projectHooks.scripts)),
            },
      marketplace: data.marketplace,
      dependents: data.dependents ?? [],
    });
  }

  toJSON(): PluginEntryData {
    const data: PluginEntryData = {
      name: this.name,
      source: serializePluginSource(this.source),
      version: this.version,
      strict: this.strict,
      files: mapToRecord(this.files),
      scope: this.scope,
    };
    if (this.componentPaths.size > 0) data.componentPaths = mapToRecord(this.componentPaths);
    if (this.mcpEntries.size > 0) data.mcpEntries = mapToRecord(this.mcpEntries);
    if (this.projectHooks !== undefined) {
      data.projectHooks = {
        entries: [...this.projectHooks.entries],
        scripts: mapToRecord(this.projectHooks.scripts),
      };
    }
    if (this.marketplace !== undefined) data.marketplace = this.marketplace;
    if (this.dependents.length > 0) data.dependents = [...this.dependents];
    return data;
  }

  isFileTracked(relPath: string): boolean {
    return this.files.has(relPath);
  }

  withVersion(v: string): InstalledPlugin {
    return new InstalledPlugin({
      name: this.name,
      source: this.source,
      version: v,
      strict: this.strict,
      files: this.files,
      scope: this.scope,
      componentPaths: this.componentPaths,
      mcpEntries: this.mcpEntries,
      projectHooks: this.projectHooks,
      marketplace: this.marketplace,
      dependents: this.dependents,
    });
  }

  withFiles(f: ReadonlyMap<string, string>): InstalledPlugin {
    return new InstalledPlugin({
      name: this.name,
      source: this.source,
      version: this.version,
      strict: this.strict,
      files: asPathHashMap(f),
      scope: this.scope,
      componentPaths: this.componentPaths,
      mcpEntries: this.mcpEntries,
      projectHooks: this.projectHooks,
      marketplace: this.marketplace,
      dependents: this.dependents,
    });
  }

  withDependents(dependents: readonly string[]): InstalledPlugin {
    return new InstalledPlugin({
      name: this.name,
      source: this.source,
      version: this.version,
      strict: this.strict,
      files: this.files,
      scope: this.scope,
      componentPaths: this.componentPaths,
      mcpEntries: this.mcpEntries,
      projectHooks: this.projectHooks,
      marketplace: this.marketplace,
      dependents: [...new Set(dependents)],
    });
  }
}

function mapToRecord(map: ReadonlyMap<string, string>): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of map) {
    record[key] = value;
  }
  return record;
}
