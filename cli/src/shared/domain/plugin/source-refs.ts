import type { PluginName } from "./plugin-name.js";

/** Minimal reference to the source marketplace catalog, shared by tools' build contract and
 * translate. */
export interface SourceMarketplaceRef {
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
  readonly owner?: unknown;
  readonly plugins: readonly SourcePluginEntryRef[];
  readonly [key: string]: unknown;
}

export interface SourcePluginEntryRef {
  readonly name: PluginName;
  readonly version?: string;
  readonly description?: string;
  readonly strict?: boolean;
  readonly metadata?: { readonly recommended?: boolean };
  readonly [key: string]: unknown;
}
