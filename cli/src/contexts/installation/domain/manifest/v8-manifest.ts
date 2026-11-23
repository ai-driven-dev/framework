import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import type { ToolId, ToolIdResolver } from "../../../../shared/domain/tool.js";
import { InvalidManifestDataError } from "../../contract/installation.error.js";

/** The one version read only to be split: its tools carried their host registration inline. */
export const V8_MANIFEST_VERSION = 8;

export function isV8Manifest(document: unknown): document is Record<string, unknown> {
  return asPlainObject(document)?.version === V8_MANIFEST_VERSION;
}

/** A v8 document split into its tool entries and the host registration each one carried, kept
 * opaque as it came. The dependents a plugin entry carried leave it for the record's claims, one
 * `{plugin, dependents}` claim each, after the claims the record already held. A tool key no tool
 * resolves to is left to the manifest's own reading to refuse. */
export function splitV8Manifest(
  document: Record<string, unknown>,
  resolveToolId: ToolIdResolver
): {
  readonly tools: Record<string, unknown>;
  readonly records: Map<ToolId, Readonly<Record<string, unknown>>>;
} {
  const tools: Record<string, unknown> = {};
  const records = new Map<ToolId, Readonly<Record<string, unknown>>>();
  for (const [key, value] of Object.entries(asPlainObject(document.tools) ?? {})) {
    const { entry, record } = splitEntry(key, value);
    tools[key] = entry;
    if (record === undefined) continue;
    const toolId = resolveToolId(key);
    if (toolId !== null) records.set(toolId, record);
  }
  return { tools, records };
}

/** One tool's entry without its record and the dependents of its plugins, and a record when it
 * carried one or its plugins carried dependents. */
function splitEntry(
  key: string,
  value: unknown
): { readonly entry: unknown; readonly record?: Readonly<Record<string, unknown>> } {
  const entry = asPlainObject(value);
  if (entry === null) return { entry: value };
  const { nativeRegistrations, ...rest } = entry;
  const { plugins, claims } = liftDependents(rest.plugins);
  const held = recordOf(key, nativeRegistrations);
  if (held === undefined && claims.length === 0) return { entry: value };
  const kept = plugins === undefined ? rest : { ...rest, plugins };
  if (claims.length === 0) return { entry: kept, record: held };
  return { entry: kept, record: { ...held, pluginClaims: [...claimsHeld(key, held), ...claims] } };
}

function recordOf(key: string, value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (value === undefined) return undefined;
  const record = asPlainObject(value);
  if (record === null) {
    throw new InvalidManifestDataError(`tools.${key}.nativeRegistrations: expected an object.`);
  }
  return { ...record };
}

function claimsHeld(key: string, record: Readonly<Record<string, unknown>> | undefined): unknown[] {
  const held = record?.pluginClaims;
  if (held === undefined) return [];
  if (!Array.isArray(held)) {
    throw new InvalidManifestDataError(
      `tools.${key}.nativeRegistrations.pluginClaims: expected an array.`
    );
  }
  return held;
}

/** The plugin entries without their dependents, and the claim each carried one for. */
function liftDependents(plugins: unknown): { plugins?: unknown[]; claims: unknown[] } {
  if (!Array.isArray(plugins)) return { claims: [] };
  const claims: unknown[] = [];
  const lifted = plugins.map((item) => {
    const plugin = asPlainObject(item);
    if (plugin === null || plugin.dependents === undefined || typeof plugin.name !== "string")
      return item;
    const { dependents, ...rest } = plugin;
    claims.push({ plugin: plugin.name, dependents });
    return rest;
  });
  return { plugins: lifted, claims };
}
