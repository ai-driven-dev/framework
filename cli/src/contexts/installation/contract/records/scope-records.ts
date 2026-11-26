import type { ToolId } from "../../../../shared/domain/tool.js";

/**
 * What is recorded for a tool's host registration, as it came. The record is opaque here: host
 * registration reads its host data and machine claims the claims block it keeps beside it, so
 * installation reads, checks and reorders nothing on the way in or out.
 *
 * Limit: a hand-edited record keeps what the host's rewrites pass through. Every host read goes
 * through `validProvenance`, so nothing invalid is acted on. A rewrite through the host codec
 * normalizes: `withoutMarketplace` drops entry-level unknown keys and invalid provenance but keeps
 * the top-level keys, and `afterActivation` and `mergeCatalogueClaims` drop all of it. A
 * pass-through rewrite (`withoutRef`) keeps unknown keys and invalid provenance as they came. No
 * record has been seen to hold either.
 */
export type ToolRecord = Readonly<Record<string, unknown>>;

/** Each tool's record in one scope. A tool without one is absent. */
export type ToolRecords = Map<ToolId, ToolRecord>;

/** One scope's records, handed over in the request by the caller that owns where they live:
 * installation rewrites them in step with the manifest and never reaches them itself. A v8
 * manifest is split before either call touches them, so its records are never read or written
 * over. Saving none removes what was kept. */
export interface ScopeRecords {
  loadRecords(): Promise<ToolRecords>;
  saveRecords(records: ToolRecords): Promise<void>;
}
