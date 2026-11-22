import { isAbsolute } from "node:path";
import { tryParseJson } from "../../../../shared/domain/reading/json-file.js";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import {
  InvalidPluginManifestError,
  InvalidPluginSourceError,
} from "../../../../shared/domain/shared.error.js";
import { parsePluginSource } from "../../../../shared/domain/source-parsing.js";
import type { PluginCatalog, PluginCatalogEntry } from "../../contract/catalog.js";

function parseEntry(raw: unknown, index: number): PluginCatalogEntry {
  const obj = asPlainObject(raw);
  if (obj === null) {
    throw new InvalidPluginManifestError(`plugins[${index}] must be an object`);
  }

  if (typeof obj.name !== "string" || obj.name.length === 0) {
    throw new InvalidPluginManifestError(`plugins[${index}].name must be a non-empty string`);
  }

  if (obj.source === undefined) {
    throw new InvalidPluginManifestError(`plugins[${index}].source is required`);
  }

  const source = parsePluginSource(obj.source);

  const entry: PluginCatalogEntry = {
    name: obj.name,
    source,
    recommended: recommendedUnderMetadata(obj.metadata),
    strict: typeof obj.strict === "boolean" ? obj.strict : false,
  };

  if (typeof obj.description === "string") entry.description = obj.description;
  if (typeof obj.version === "string") entry.version = obj.version;

  return entry;
}

function recommendedUnderMetadata(metadata: unknown): boolean {
  const recommended = asPlainObject(metadata)?.recommended;
  return typeof recommended === "boolean" ? recommended : false;
}

export function hasRelativePluginSources(catalog: PluginCatalog): boolean {
  return catalog.plugins.some(
    (entry) => entry.source.kind === "local" && !isAbsolute(entry.source.path)
  );
}

export function parsePluginCatalog(raw: unknown): PluginCatalog {
  const obj = asPlainObject(raw);
  if (obj === null) {
    throw new InvalidPluginManifestError("marketplace.json must be a JSON object");
  }

  if (!Array.isArray(obj.plugins)) {
    throw new InvalidPluginManifestError('"plugins" must be an array');
  }

  const plugins = obj.plugins.map((entry, i) => parseEntry(entry, i));
  const catalog: PluginCatalog = { plugins };
  if (typeof obj.name === "string" && obj.name.length > 0) catalog.name = obj.name;
  if (typeof obj.version === "string" && obj.version.length > 0) catalog.version = obj.version;
  return catalog;
}

export type ParsedPluginCatalog =
  | { readonly ok: true; readonly catalog: PluginCatalog }
  | { readonly ok: false; readonly error: unknown };

/** `parsePluginCatalog` over catalog text, saying whether it parsed and why not: a caller
 * holding a cache it may not trust has no `try` of its own to get wrong. */
export function tryParsePluginCatalog(text: string): ParsedPluginCatalog {
  const json = tryParseJson(text);
  if (!json.ok) return json;
  try {
    return { ok: true, catalog: parsePluginCatalog(json.value) };
  } catch (error) {
    if (error instanceof InvalidPluginManifestError || error instanceof InvalidPluginSourceError)
      return { ok: false, error };
    throw error;
  }
}
