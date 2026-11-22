import { isScope } from "../../../../shared/domain/scope.js";
import { isSemver } from "../../../../shared/domain/semver.js";
import { serializePluginSource } from "../../../../shared/domain/source.js";
import { parsePluginSource } from "../../../../shared/domain/source-parsing.js";
import {
  InvalidPluginNameError,
  InvalidPluginVersionError,
  MalformedPluginScopeError,
} from "../installation.error.js";
import type { FileProvenance } from "./file-provenance.js";
import {
  asComponentPathMap,
  asMcpDigestMap,
  asPathHashMap,
  PLUGIN_NAME_REGEX,
  type PluginEntryData,
  type PluginFields,
} from "./plugin-entry.js";

/** Validates a stored entry and reads it into the fields of an installed plugin. */
export function pluginFieldsFromEntry(data: PluginEntryData): PluginFields {
  if (!PLUGIN_NAME_REGEX.test(data.name)) throw new InvalidPluginNameError(data.name);
  if (!isSemver(data.version)) throw new InvalidPluginVersionError(data.version);
  if (!isScope(data.scope)) throw new MalformedPluginScopeError(data.name, data.scope);
  return {
    name: data.name,
    source: parsePluginSource(data.source),
    version: data.version,
    strict: data.strict,
    files: asPathHashMap(new Map(Object.entries(data.files))),
    scope: data.scope,
    provenance: provenanceFromEntry(data),
    marketplace: data.marketplace,
    dependents: data.dependents ?? [],
  };
}

/** Writes the fields of an installed plugin as a stored entry, leaving out what is empty. */
export function entryFromPluginFields(fields: PluginFields): PluginEntryData {
  const data: PluginEntryData = {
    name: fields.name,
    source: serializePluginSource(fields.source),
    version: fields.version,
    strict: fields.strict,
    files: Object.fromEntries(fields.files),
    scope: fields.scope,
  };
  writeProvenance(data, fields.provenance);
  if (fields.marketplace !== undefined) data.marketplace = fields.marketplace;
  if (fields.dependents.length > 0) data.dependents = [...fields.dependents];
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
