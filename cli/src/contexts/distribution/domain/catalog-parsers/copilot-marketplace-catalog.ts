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
  const name = requireNonEmpty(obj.name, `plugins[${index}].name`);
  const source = requireNonEmpty(obj.source, `plugins[${index}].source`);
  const entry: PluginCatalogEntry = {
    name,
    source: { kind: "local", path: `${pluginRoot}/${source}` },
    recommended: false,
    strict: false,
  };
  const description = nonEmpty(obj.description);
  if (description !== undefined) entry.description = description;
  const version = nonEmpty(obj.version);
  if (version !== undefined) entry.version = version;
  return entry;
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requireNonEmpty(value: unknown, field: string): string {
  const found = nonEmpty(value);
  if (found === undefined) {
    throw new InvalidPluginManifestError(`${COPILOT_SOURCE}: ${field} must be a non-empty string`);
  }
  return found;
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
