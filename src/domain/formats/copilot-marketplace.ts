/**
 * Copilot marketplace format adapter — pure parser, no I/O.
 *
 * Copilot has no multi-plugin catalog convention. The "marketplace" is a Git
 * repository where each repo publishes exactly ONE plugin via the manifest at
 * `.github/plugin/plugin.json`. This adapter treats that single-plugin manifest
 * as a degenerate one-entry catalog.
 *
 * Documented fields (per https://code.visualstudio.com/docs/copilot/customization/agent-plugins):
 *   name (required, kebab-case ≤64 chars), description, version, author.name
 *   + agents, skills, hooks, mcpServers — ignored for NormalizedPlugin extraction.
 *
 * NOTE: The task plan suggested `.github/agents/` as the manifest path based on
 * earlier Part 2 research. Primary-source evidence from the actual Copilot docs
 * and the github/awesome-copilot repo confirms `.github/plugin/plugin.json` as
 * the canonical location. This overrides the prior assumption.
 */

import { ForeignSchemaValidationError } from "../errors.js";
import type { NormalizedCatalog, NormalizedPlugin } from "../models/normalized-plugin.js";

const SOURCE = "copilot";

export function parseCopilotMarketplace(rawJson: string): NormalizedCatalog {
  const parsed = parseJson(rawJson);
  const plugin = parsePlugin(parsed);
  return { source: SOURCE, plugins: [plugin] };
}

function parseJson(rawJson: string): unknown {
  try {
    return JSON.parse(rawJson);
  } catch {
    throw new ForeignSchemaValidationError(SOURCE, "plugin.json is not valid JSON");
  }
}

function parsePlugin(parsed: unknown): NormalizedPlugin {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ForeignSchemaValidationError(SOURCE, "plugin.json must be a JSON object");
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.name !== "string" || obj.name.length === 0) {
    throw new ForeignSchemaValidationError(SOURCE, '"name" must be a non-empty string');
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
