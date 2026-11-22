import type { ToolId } from "../../../shared/domain/tool.js";

type RecordData = Readonly<Record<string, unknown>>;

/** Each tool's record in two: its host data, whole but for the claims block, and the claims block
 * of a tool holding one. */
export function splitPluginClaims(records: ReadonlyMap<ToolId, RecordData>): {
  readonly host: Map<ToolId, RecordData>;
  readonly claims: Map<ToolId, unknown>;
} {
  const host = new Map<ToolId, RecordData>();
  const claims = new Map<ToolId, unknown>();
  for (const [toolId, { pluginClaims, ...hostData }] of records) {
    host.set(toolId, hostData);
    if (pluginClaims !== undefined) claims.set(toolId, pluginClaims);
  }
  return { host, claims };
}

/** The two halves joined back: each tool's claims beside its host data, a tool holding only claims
 * recorded with them alone. */
export function joinPluginClaims(
  host: ReadonlyMap<ToolId, RecordData>,
  claims: ReadonlyMap<ToolId, unknown>
): Map<ToolId, RecordData> {
  const records = new Map<ToolId, RecordData>(host);
  for (const [toolId, pluginClaims] of claims) {
    records.set(toolId, { ...host.get(toolId), pluginClaims });
  }
  return records;
}
