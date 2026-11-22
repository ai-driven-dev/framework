import type { InstallationFile } from "../../../../shared/domain/installation-file.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import {
  type PluginSource,
  serializePluginSource,
} from "../../../../shared/domain/plugin/source.js";
import type { Scope } from "../../../../shared/domain/scope.js";
import type { FileProvenance } from "./file-provenance.js";
import type { InstalledPlugin } from "./installed-plugin.js";
import {
  asMcpDigestMap,
  type PluginEntryData,
  type ProjectHooksProvenance,
} from "./plugin-entry.js";
import { entryFromRecordedPlugin, recordedPluginFromEntry } from "./plugin-entry-codec.js";

/** The parts a manifest records for one plugin, so a changed copy spreads one into another. */
export interface RecordedPluginParts {
  readonly plugin: InstalledPlugin;
  readonly provenance: FileProvenance;
  /** The marketplace alias the plugin was installed from: a reference host registration resolves. */
  readonly marketplace?: string;
  /** The machine claim on the plugin's user-scope files, kept as it came: machine claims read and
   * write it, installation only carries it. */
  readonly machineClaim?: unknown;
}

/** One plugin as a manifest records it. What installation owns of it stays apart from the
 * provenance of what translation wrote, the host reference and the machine claim. */
export class RecordedPlugin implements RecordedPluginParts {
  readonly plugin: InstalledPlugin;
  readonly provenance: FileProvenance;
  readonly marketplace?: string;
  readonly machineClaim?: unknown;

  private constructor(parts: RecordedPluginParts) {
    this.plugin = parts.plugin;
    this.provenance = parts.provenance;
    this.marketplace = parts.marketplace;
    this.machineClaim = parts.machineClaim;
  }

  static fromMetadata(metadata: {
    name: string;
    version: string;
    source: PluginSource;
    strict: boolean;
    scope: Scope;
    marketplace?: string;
  }): RecordedPlugin {
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
    return RecordedPlugin.fromJSON(data);
  }

  static fromDistribution(installed: {
    dist: PluginDistribution;
    source: PluginSource;
    files: InstallationFile[];
    scope: Scope;
    componentPaths?: ReadonlyMap<string, string>;
    marketplace?: string;
  }): RecordedPlugin {
    const { dist, source, files, scope, componentPaths, marketplace } = installed;
    const data: PluginEntryData = {
      name: dist.manifest.name,
      source: serializePluginSource(source),
      version: dist.manifest.version,
      strict: dist.manifest.strict ?? false,
      files: Object.fromEntries(files.map((f) => [f.relativePath, f.hash.value])),
      scope,
      componentPaths: Object.fromEntries(componentPaths ?? []),
    };
    if (marketplace !== undefined) data.marketplace = marketplace;
    return RecordedPlugin.fromJSON(data);
  }

  static fromDistributionWithMcp(
    installed: Parameters<typeof RecordedPlugin.fromDistribution>[0] & {
      mcpEntries: ReadonlyMap<string, string>;
    }
  ): RecordedPlugin {
    const { mcpEntries, ...distribution } = installed;
    return RecordedPlugin.fromDistribution(distribution).withMcpEntries(mcpEntries);
  }

  static fromJSON(data: PluginEntryData): RecordedPlugin {
    return new RecordedPlugin(recordedPluginFromEntry(data));
  }

  toJSON(): PluginEntryData {
    return entryFromRecordedPlugin(this);
  }

  withPlugin(plugin: InstalledPlugin): RecordedPlugin {
    return new RecordedPlugin({ ...this, plugin });
  }

  withFiles(files: ReadonlyMap<string, string>): RecordedPlugin {
    return this.withPlugin(this.plugin.withFiles(files));
  }

  withMcpEntries(mcpEntries: ReadonlyMap<string, string>): RecordedPlugin {
    const provenance = { ...this.provenance, mcpEntries: asMcpDigestMap(mcpEntries) };
    return new RecordedPlugin({ ...this, provenance });
  }

  withProjectHooks(projectHooks: ProjectHooksProvenance | undefined): RecordedPlugin {
    return new RecordedPlugin({ ...this, provenance: { ...this.provenance, projectHooks } });
  }

  withMachineClaim(machineClaim: unknown): RecordedPlugin {
    return new RecordedPlugin({ ...this, machineClaim });
  }
}
