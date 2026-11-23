import { parsePluginName } from "../../../../shared/domain/plugin/plugin-name.js";
import { isSemver } from "../../../../shared/domain/plugin/semver.js";
import { serializePluginSource } from "../../../../shared/domain/plugin/source.js";
import { parsePluginSource } from "../../../../shared/domain/plugin/source-parsing.js";
import { isScope } from "../../../../shared/domain/scope.js";
import { InvalidPluginVersionError } from "../../../../shared/domain/shared.error.js";
import { MalformedPluginScopeError } from "../../contract/installation.error.js";
import type { FileProvenance } from "./file-provenance.js";
import { InstalledPlugin } from "./installed-plugin.js";
import {
  asComponentPathMap,
  asMcpDigestMap,
  asPathHashMap,
  type PluginEntryData,
} from "./plugin-entry.js";
import type { RecordedPluginParts } from "./recorded-plugin.js";

/** Validates a stored entry and reads it into the parts a manifest records for a plugin. */
export function recordedPluginFromEntry(data: PluginEntryData): RecordedPluginParts {
  const name = parsePluginName(data.name);
  if (!isSemver(data.version)) throw new InvalidPluginVersionError(data.version);
  if (!isScope(data.scope)) throw new MalformedPluginScopeError(data.name, data.scope);
  const plugin = new InstalledPlugin({
    name,
    source: parsePluginSource(data.source),
    version: data.version,
    strict: data.strict,
    files: asPathHashMap(new Map(Object.entries(data.files))),
    scope: data.scope,
  });
  return {
    plugin,
    provenance: provenanceFromEntry(data),
    marketplace: data.marketplace,
  };
}

/** Writes a recorded plugin back as one stored entry, in the stored key order, leaving out what
 * is empty: the installed plugin first, then its provenance, its marketplace. */
export function entryFromRecordedPlugin(recorded: RecordedPluginParts): PluginEntryData {
  const { plugin } = recorded;
  const data: PluginEntryData = {
    name: plugin.name,
    source: serializePluginSource(plugin.source),
    version: plugin.version,
    strict: plugin.strict,
    files: Object.fromEntries(plugin.files),
    scope: plugin.scope,
  };
  writeProvenance(data, recorded.provenance);
  if (recorded.marketplace !== undefined) data.marketplace = recorded.marketplace;
  return data;
}

function provenanceFromEntry(data: PluginEntryData): FileProvenance {
  return {
    componentPaths: asComponentPathMap(new Map(Object.entries(data.componentPaths ?? {}))),
    mcpEntries: asMcpDigestMap(new Map(Object.entries(data.mcpEntries ?? {}))),
    projectHooks:
      data.projectHooks === undefined
        ? undefined
        : {
            entries: data.projectHooks.entries,
            scripts: new Map(Object.entries(data.projectHooks.scripts)),
          },
  };
}

function writeProvenance(data: PluginEntryData, provenance: FileProvenance): void {
  const { componentPaths, mcpEntries, projectHooks } = provenance;
  if (componentPaths.size > 0) data.componentPaths = Object.fromEntries(componentPaths);
  if (mcpEntries.size > 0) data.mcpEntries = Object.fromEntries(mcpEntries);
  if (projectHooks !== undefined) {
    data.projectHooks = {
      entries: [...projectHooks.entries],
      scripts: Object.fromEntries(projectHooks.scripts),
    };
  }
}
