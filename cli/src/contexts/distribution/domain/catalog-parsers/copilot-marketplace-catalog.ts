/**
 * Copilot-native multi-plugin marketplace catalog parser: pure, no I/O. An entry's `source` is
 * a bare subdirectory name, combined with `metadata.pluginRoot` into a relative local source so
 * the adapter's own `resolveLocalPaths` lifts it to an absolute path.
 */

import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import { InvalidPluginManifestError } from "../../../../shared/domain/shared.error.js";
import type { PluginCatalog, PluginCatalogEntry } from "../../contract/catalog.js";

const COPILOT_SOURCE = "copilot-catalog";

function parseRaw(rawJson: string): unknown {
  try {
    return JSON.parse(rawJson);
  } catch {
    throw new InvalidPluginManifestError(`${COPILOT_SOURCE}: marketplace.json is not valid JSON`);
  }
}

function extractPluginRoot(obj: Record<string, unknown>): string {
  const meta = asPlainObject(obj.metadata);
  if (meta === null) {
    throw new InvalidPluginManifestError(`${COPILOT_SOURCE}: "metadata" must be an object`);
  }
  if (typeof meta.pluginRoot !== "string" || meta.pluginRoot.length === 0) {
    throw new InvalidPluginManifestError(
      `${COPILOT_SOURCE}: "metadata.pluginRoot" must be a non-empty string`
    );
  }
  return meta.pluginRoot;
}

function parseEntry(raw: unknown, index: number, pluginRoot: string): PluginCatalogEntry {
  const obj = asPlainObject(raw);
  if (obj === null) {
    throw new InvalidPluginManifestError(`${COPILOT_SOURCE}: plugins[${index}] must be an object`);
  }
  if (typeof obj.name !== "string" || obj.name.length === 0) {
    throw new InvalidPluginManifestError(
      `${COPILOT_SOURCE}: plugins[${index}].name must be a non-empty string`
    );
  }
  if (typeof obj.source !== "string" || obj.source.length === 0) {
    throw new InvalidPluginManifestError(
      `${COPILOT_SOURCE}: plugins[${index}].source must be a non-empty string`
    );
  }
  const entry: PluginCatalogEntry = {
    name: obj.name,
    source: { kind: "local", path: `${pluginRoot}/${obj.source}` },
    recommended: false,
    strict: false,
  };
  if (typeof obj.description === "string" && obj.description.length > 0) {
    entry.description = obj.description;
  }
  if (typeof obj.version === "string" && obj.version.length > 0) {
    entry.version = obj.version;
  }
  return entry;
}

export function parseCopilotMarketplaceCatalog(rawJson: string): PluginCatalog {
  const parsed = parseRaw(rawJson);
  const obj = asPlainObject(parsed);
  if (obj === null) {
    throw new InvalidPluginManifestError(
      `${COPILOT_SOURCE}: marketplace.json must be a JSON object`
    );
  }
  const pluginRoot = extractPluginRoot(obj);
  if (!Array.isArray(obj.plugins)) {
    throw new InvalidPluginManifestError(`${COPILOT_SOURCE}: "plugins" must be an array`);
  }
  const plugins = obj.plugins.map((entry, i) => parseEntry(entry, i, pluginRoot));
  const catalog: PluginCatalog = { plugins };
  if (typeof obj.name === "string" && obj.name.length > 0) catalog.name = obj.name;
  return catalog;
}
