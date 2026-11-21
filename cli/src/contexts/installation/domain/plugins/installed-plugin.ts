import type { InstallationFile } from "../../../../shared/domain/installation-file.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { Scope } from "../../../../shared/domain/scope.js";
import { type PluginSource, serializePluginSource } from "../../../../shared/domain/source.js";
import {
  asMcpDigestMap,
  asPathHashMap,
  type ComponentPathMap,
  type McpDigestMap,
  type PathHashMap,
  type PluginEntryData,
  type PluginFields,
  type ProjectHooksProvenance,
} from "./plugin-entry.js";
import { entryFromPluginFields, pluginFieldsFromEntry } from "./plugin-entry-codec.js";

export class InstalledPlugin {
  readonly name: string;
  readonly source: PluginSource;
  readonly version: string;
  readonly strict: boolean;
  readonly files: PathHashMap;
  /** What `files` keys are relative to: the project root, or the tool's user-scope plugins
   * directory. Recorded once, at install, and never re-derived from a tool's current profile,
   * which can disagree with what was true when the entry was written. */
  readonly scope: Scope;
  readonly componentPaths: ComponentPathMap;
  readonly mcpEntries: McpDigestMap;
  readonly projectHooks?: ProjectHooksProvenance;
  readonly marketplace?: string;
  readonly dependents: readonly string[];

  private constructor(params: PluginFields) {
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

  static fromMetadata(metadata: {
    name: string;
    version: string;
    source: PluginSource;
    strict: boolean;
    scope: Scope;
    marketplace?: string;
  }): InstalledPlugin {
    const { name, version, source, strict, scope, marketplace } = metadata;
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
    return new InstalledPlugin({ ...plugin, mcpEntries: asMcpDigestMap(mcpEntries) });
  }

  static withProjectHooks(
    plugin: InstalledPlugin,
    projectHooks: ProjectHooksProvenance | undefined
  ): InstalledPlugin {
    return new InstalledPlugin({ ...plugin, projectHooks });
  }

  static fromDistribution(installed: {
    dist: PluginDistribution;
    source: PluginSource;
    files: InstallationFile[];
    scope: Scope;
    componentPaths?: ReadonlyMap<string, string>;
    marketplace?: string;
  }): InstalledPlugin {
    const { dist, source, files, scope, componentPaths, marketplace } = installed;
    const filesRecord = Object.fromEntries(files.map((f) => [f.relativePath, f.hash.value]));
    const componentPathsRecord = Object.fromEntries(componentPaths ?? []);
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
    installed: Parameters<typeof InstalledPlugin.fromDistribution>[0] & {
      mcpEntries: ReadonlyMap<string, string>;
    }
  ): InstalledPlugin {
    const { mcpEntries, ...distribution } = installed;
    return InstalledPlugin.withMcpEntries(
      InstalledPlugin.fromDistribution(distribution),
      mcpEntries
    );
  }

  static fromJSON(data: PluginEntryData): InstalledPlugin {
    return new InstalledPlugin(pluginFieldsFromEntry(data));
  }

  toJSON(): PluginEntryData {
    return entryFromPluginFields(this);
  }

  isFileTracked(relPath: string): boolean {
    return this.files.has(relPath);
  }

  withVersion(v: string): InstalledPlugin {
    return new InstalledPlugin({ ...this, version: v });
  }

  withFiles(f: ReadonlyMap<string, string>): InstalledPlugin {
    return new InstalledPlugin({ ...this, files: asPathHashMap(f) });
  }

  withDependents(dependents: readonly string[]): InstalledPlugin {
    return new InstalledPlugin({ ...this, dependents: [...new Set(dependents)] });
  }
}
