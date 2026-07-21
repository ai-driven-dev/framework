/**
 * OpenCode marketplace format adapter — pure parser, no I/O.
 *
 * OpenCode has no dedicated marketplace.json or per-project plugin manifest
 * convention. Plugins are referenced by npm package name (or local file path)
 * in the project-level `opencode.json` config file under a `plugin` array.
 * Each entry is either a bare string specifier or a [specifier, options] tuple.
 *
 * This adapter treats the `plugin` array in `opencode.json` as a plugin catalog.
 * A missing or empty `plugin` field yields an empty catalog (it is optional per
 * the OpenCode config schema). No version or description is available at this
 * layer; those fields are always omitted from the NormalizedPlugin output.
 *
 * Documented fields (per https://opencode.ai/docs/config and packages/opencode/src/config/plugin.ts):
 *   plugin: (string | [string, Record<string, unknown>])[]  — optional array
 *
 * Probe path: `opencode.json` (strict JSON, project root — the public convention).
 * The `.opencode/opencode.jsonc` variant used in the OpenCode repo itself is JSONC
 * and requires a separate parser; `opencode.json` is sufficient for catalog detection.
 */

import { ForeignSchemaValidationError } from "../errors.js";
import type { NormalizedCatalog, NormalizedPlugin } from "../models/normalized-plugin.js";

const SOURCE = "opencode";

export function parseOpencodeMarketplace(rawJson: string): NormalizedCatalog {
  const parsed = parseJson(rawJson);
  const plugins = extractPlugins(parsed);
  return { source: SOURCE, plugins };
}

function parseJson(rawJson: string): unknown {
  try {
    return JSON.parse(rawJson);
  } catch {
    throw new ForeignSchemaValidationError(SOURCE, "opencode.json is not valid JSON");
  }
}

function extractPlugins(parsed: unknown): readonly NormalizedPlugin[] {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ForeignSchemaValidationError(SOURCE, "opencode.json must be a JSON object");
  }
  const obj = parsed as Record<string, unknown>;
  if (!("plugin" in obj) || obj.plugin === undefined) {
    return [];
  }
  if (!Array.isArray(obj.plugin)) {
    throw new ForeignSchemaValidationError(SOURCE, '"plugin" must be an array');
  }
  return obj.plugin.map((entry, i) => parseEntry(entry, i));
}

function parseEntry(raw: unknown, index: number): NormalizedPlugin {
  const spec = extractSpec(raw, index);
  if (typeof spec !== "string" || spec.length === 0) {
    throw new ForeignSchemaValidationError(
      SOURCE,
      `plugin[${index}] specifier must be a non-empty string`
    );
  }
  return { name: spec, source: SOURCE };
}

function extractSpec(raw: unknown, index: number): unknown {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      throw new ForeignSchemaValidationError(SOURCE, `plugin[${index}] tuple must not be empty`);
    }
    return raw[0];
  }
  throw new ForeignSchemaValidationError(
    SOURCE,
    `plugin[${index}] must be a string or [string, options] tuple`
  );
}
