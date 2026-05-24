import { MarketplaceEntryAlreadyExistsError } from "../errors.js";

export interface MarketplaceLocalEntry {
  name: string;
  version: string;
  source: string;
  description: string;
  recommended: boolean;
  strict: boolean;
}

interface MarketplaceJson {
  plugins?: MarketplaceLocalEntry[];
  [key: string]: unknown;
}

export function appendPluginToMarketplace(json: string, entry: MarketplaceLocalEntry): string {
  const parsed = JSON.parse(json) as MarketplaceJson;
  const plugins = parsed.plugins ?? [];

  const collision = plugins.findIndex((p) => p.name === entry.name);
  if (collision !== -1) {
    throw new MarketplaceEntryAlreadyExistsError(entry.name, collision, "(marketplace.json)");
  }

  const updated: MarketplaceJson = {
    ...parsed,
    plugins: [...plugins, entry],
  };
  return `${JSON.stringify(updated, null, 2)}\n`;
}
