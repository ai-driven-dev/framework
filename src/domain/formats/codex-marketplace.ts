/**
 * Codex marketplace format adapter — pure parser, no I/O.
 *
 * Codex supports a multi-plugin marketplace catalog at `.agents/plugins/marketplace.json`
 * (repo-scoped) or `~/.agents/plugins/marketplace.json` (personal scope).
 * This adapter targets the repo-scoped path, treated as a multi-entry catalog.
 *
 * Documented fields (per https://developers.openai.com/codex/plugins/build):
 *   name (required), version (required by spec), description (required by spec)
 *   + author, homepage, repository, license, keywords, skills, mcpServers,
 *     apps, hooks, interface — ignored for NormalizedPlugin extraction.
 *
 * Marketplace catalog shape: { name?, plugins: [{ name, version?, description? }] }
 * Mirrors Cursor's shape (multi-plugin array), not Copilot's (single-plugin manifest).
 */

import { ForeignSchemaValidationError } from "../errors.js";
import type { NormalizedCatalog, NormalizedPlugin } from "../models/normalized-plugin.js";

const SOURCE = "codex";

export function parseCodexMarketplace(rawJson: string): NormalizedCatalog {
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
  return withOptionalFields({ name: obj.name, source: SOURCE }, obj);
}

function withOptionalFields(
  plugin: NormalizedPlugin,
  obj: Record<string, unknown>
): NormalizedPlugin {
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
