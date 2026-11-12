import {
  InvalidManifestDataError,
  InvalidPluginNameError,
  InvalidPluginVersionError,
  MalformedPluginScopeError,
} from "../../../../kernel/errors.js";
import type { InstallationFile, UserFileOverrides } from "../../../../kernel/file.js";
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
  /** User settings retained when regenerating owned files, keyed by plugin-relative file path. */
  userFileOverrides?: UserFileOverrides;
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
  readonly userFileOverrides: UserFileOverrides;

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
    userFileOverrides: UserFileOverrides;
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
    this.userFileOverrides = params.userFileOverrides;
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
      userFileOverrides: plugin.userFileOverrides,
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
      userFileOverrides: plugin.userFileOverrides,
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
      userFileOverrides: parseUserFileOverrides(data.userFileOverrides, files),
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
    if (Object.keys(this.userFileOverrides).length > 0) {
      data.userFileOverrides = { ...this.userFileOverrides };
    }
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
      userFileOverrides: this.userFileOverrides,
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
      userFileOverrides: this.userFileOverrides,
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
      userFileOverrides: this.userFileOverrides,
    });
  }

  withUserFileOverrides(overrides: UserFileOverrides): InstalledPlugin {
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
      dependents: this.dependents,
      userFileOverrides: parseUserFileOverrides({ ...overrides }, this.files),
    });
  }
}

export function parseUserFileOverrides(
  value: unknown,
  trackedFiles: ReadonlyMap<string, string>
): UserFileOverrides {
  if (value === undefined) return {};
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidManifestDataError("invalid user file overrides.");
  }
  for (const [path, settings] of Object.entries(value)) {
    if (
      path.startsWith("/") ||
      path.includes("\\") ||
      path.split("/").some((segment) => segment === "" || segment === "." || segment === "..") ||
      !trackedFiles.has(path)
    ) {
      throw new InvalidManifestDataError(`invalid user file override path '${path}'.`);
    }
    if (settings === null || typeof settings !== "object" || Array.isArray(settings)) {
      throw new InvalidManifestDataError(`invalid user file override for '${path}'.`);
    }
    const keys = Object.keys(settings);
    if (
      keys.length === 0 ||
      keys.some((key) => key.trim().length === 0) ||
      keys.some((key) => {
        const value = (settings as Record<string, unknown>)[key];
        return typeof value !== "string" || value.trim().length === 0;
      })
    ) {
      throw new InvalidManifestDataError(`invalid user file override for '${path}'.`);
    }
  }
  return Object.fromEntries(
    Object.entries(value).map(([path, settings]) => [path, { ...settings }])
  );
}

function mapToRecord(map: ReadonlyMap<string, string>): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of map) {
    record[key] = value;
  }
  return record;
}
