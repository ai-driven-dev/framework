import type { PluginCatalog } from "../../../contexts/distribution/contract/catalog.js";
import type { MarketplaceView } from "../../../contexts/distribution/contract/marketplace-view.js";
import type { Output } from "../../../orchestration/domain/output.js";
import type { RefreshEntryResult } from "../../../orchestration/marketplace/refresh-marketplaces.use-case.js";
import { describePluginSource } from "../../../shared/domain/source.js";
import { render } from "../../errors/error-translator.presenter.js";

interface MarketplaceCheckOutcome {
  readonly stale: readonly { readonly name: string }[];
  readonly upstreamRemoved: readonly {
    readonly marketplace: string;
    readonly plugin: string;
    readonly toolId: string;
  }[];
  readonly skipped: readonly { readonly marketplace: string; readonly error: unknown }[];
}

export function printCatalogEntries(
  output: Output,
  marketplaceName: string,
  catalogs: ReadonlyMap<string, PluginCatalog>
): void {
  const catalog = catalogs.get(marketplaceName);
  if (catalog === undefined) {
    output.warn(`  (could not fetch catalog for '${marketplaceName}')`);
    return;
  }
  for (const entry of catalog.plugins) {
    const flag = entry.recommended ? " (recommended)" : "";
    output.print(
      `  ${entry.name}@${entry.version ?? "?"} — ${entry.description ?? ""} — ${describePluginSource(entry.source)}${flag}`
    );
  }
}

export function printRegisteredMarketplaces(
  output: Output,
  marketplaces: readonly MarketplaceView[],
  catalogs: ReadonlyMap<string, PluginCatalog> | undefined
): void {
  if (marketplaces.length === 0) output.info("No marketplaces registered.");
  for (const marketplace of marketplaces) {
    const version = marketplace.version !== undefined ? ` v${marketplace.version}` : "";
    output.print(`${marketplace.name}${version} [${marketplace.scope}]`);
    if (catalogs !== undefined) printCatalogEntries(output, marketplace.name, catalogs);
  }
}

export function printMarketplaceRegistered(output: Output, name: string): void {
  output.success(`Marketplace '${name}' registered.`);
}

export function printMarketplaceRemoved(
  output: Output,
  name: string,
  removedPluginCount: number
): void {
  output.success(`Marketplace '${name}' removed (${removedPluginCount} plugin(s) cleaned up).`);
}

export function printRefreshResults(output: Output, results: readonly RefreshEntryResult[]): void {
  for (const result of results) {
    output.print(
      `${result.name}: ${result.status}${result.error === undefined ? "" : ` (${render(result.error)})`}`
    );
  }
}

export function printMarketplaceCheck(output: Output, result: MarketplaceCheckOutcome): void {
  for (const marketplace of result.stale) output.print(`stale: ${marketplace.name}`);
  for (const removed of result.upstreamRemoved) {
    output.print(`removed: ${removed.marketplace}/${removed.plugin} (${removed.toolId})`);
  }
  for (const skip of result.skipped)
    output.warn(`skipped: ${skip.marketplace} — ${render(skip.error)}`);
  if (
    result.stale.length === 0 &&
    result.upstreamRemoved.length === 0 &&
    result.skipped.length === 0
  ) {
    output.success("All marketplaces fresh.");
  }
}
