import type { PluginCatalogEntry } from "../../contract/catalog.js";
import type { MarketplaceView } from "../../contract/marketplace-view.js";

/** A marketplace to pick from, told apart by the scope it was registered in. */
export function marketplaceChoices(
  marketplaces: readonly MarketplaceView[]
): Array<{ name: string; value: MarketplaceView }> {
  return marketplaces.map((m) => ({ name: `${m.name} [${m.scope}]`, value: m }));
}

/** A plugin to pick from, with its description when it has one, ticked when it is recommended. */
export function pluginChoices(
  entries: readonly PluginCatalogEntry[]
): Array<{ name: string; value: PluginCatalogEntry; checked: boolean }> {
  return entries.map((e) => ({
    name: e.description !== undefined ? `${e.name} — ${e.description}` : e.name,
    value: e,
    checked: e.recommended,
  }));
}
