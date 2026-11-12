import type { PluginSource } from "../../../../kernel/source.js";

export interface PluginFetchOptions {
  forceRefresh?: boolean;
  /** Use consistent Git line-ending settings for this isolated checkout. */
  canonicalCheckout?: boolean;
}

export interface PluginFetcher {
  fetch(source: PluginSource, cacheDir: string, options?: PluginFetchOptions): Promise<string>;
}
