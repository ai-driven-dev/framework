/**
 * Cursor marketplace format adapter — pure parser, no I/O.
 *
 * Cursor's marketplace.json schema is undocumented as of 2026-05-06.
 * The reference page (https://cursor.com/docs/reference/plugins.md) returns 404.
 * Documented plugin.json fields (per https://cursor.com/docs/plugins):
 *   name (required), description, version, author.name
 *
 * The marketplace.json shape mirrors Claude's existing catalog format
 * { plugins: [{ name, version?, description? }] } — lowest-risk default,
 * easily extended when Cursor publishes their schema.
 *
 * Cursor plugins use `.cursor-plugin/` as the manifest directory instead of
 * `.claude-plugin/`, and `.mdc` extension for rules.
 */

import { ForeignSchemaValidationError } from "../errors.js";
import type { NormalizedCatalog, NormalizedPlugin } from "../models/normalized-plugin.js";

const SOURCE = "cursor";

export function parseCursorMarketplace(rawJson: string): NormalizedCatalog {
  const parsed = parseJson(rawJson);
  const plugins = extractPlugins(parsed);
  return { source: SOURCE, plugins };
}

function parseJson(rawJson: string): unknown {
  try {
    return JSON.parse(rawJson);
  } catch {
    throw new ForeignSchemaValidationError(SOURCE, "marketplace.json is not valid JSON");
  }
}

function extractPlugins(parsed: unknown): readonly NormalizedPlugin[] {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ForeignSchemaValidationError(SOURCE, "marketplace.json must be a JSON object");
  }
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.plugins)) {
    throw new ForeignSchemaValidationError(SOURCE, '"plugins" must be an array');
  }
  return obj.plugins.map((entry, i) => parseEntry(entry, i));
}

function parseEntry(raw: unknown, index: number): NormalizedPlugin {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ForeignSchemaValidationError(SOURCE, `plugins[${index}] must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.name !== "string" || obj.name.length === 0) {
    throw new ForeignSchemaValidationError(
      SOURCE,
      `plugins[${index}].name must be a non-empty string`
    );
  }
  const plugin: NormalizedPlugin = { name: obj.name, source: SOURCE };
  if (typeof obj.version === "string" && obj.version.length > 0) {
    return {
      ...plugin,
      version: obj.version,
      ...(typeof obj.description === "string" ? { description: obj.description } : {}),
    };
  }
  if (typeof obj.description === "string") {
    return { ...plugin, description: obj.description };
  }
  return plugin;
}
