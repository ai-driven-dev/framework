import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import type { ToolId, ToolIdResolver } from "../../../../shared/domain/tool.js";
import { InvalidManifestDataError } from "../installation.error.js";

/** The one version read only to be split: its tools carried their host registration inline. */
export const V8_MANIFEST_VERSION = 8;

export function isV8Manifest(document: unknown): document is Record<string, unknown> {
  return asPlainObject(document)?.version === V8_MANIFEST_VERSION;
}

/** A v8 document split into its tool entries and the host registration each one carried, kept
 * opaque as it came. A tool key no tool resolves to is left to the manifest's own reading to
 * refuse. */
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

/** One tool's entry without its record, and a copy of the record when it carried one. */
function splitEntry(
  key: string,
  value: unknown
): { readonly entry: unknown; readonly record?: Readonly<Record<string, unknown>> } {
  const entry = asPlainObject(value);
  if (entry === null || entry.nativeRegistrations === undefined) return { entry: value };
  const { nativeRegistrations, ...rest } = entry;
  const record = asPlainObject(nativeRegistrations);
  if (record === null) {
    throw new InvalidManifestDataError(`tools.${key}.nativeRegistrations: expected an object.`);
  }
  return { entry: rest, record: { ...record } };
}
