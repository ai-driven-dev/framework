import type { ConfigAsset } from "../domain/config-asset.js";
import { AssetNotFoundError } from "../domain/shared.error.js";
import type { AssetProvider } from "../ports/asset-provider.js";

/** The one thing the loader asks of a tool catalog: a profile that can hand back a shipped config. */
interface ConfigAssetCatalog {
  profile(id: string): {
    configAsset(name: string): { readonly content: ConfigAsset } | undefined;
  };
}

export class BundledAssetProviderAdapter implements AssetProvider {
  constructor(private readonly tools: ConfigAssetCatalog) {}

  loadConfigAsset(toolId: string, fileName: string): ConfigAsset {
    const shipped = this.tools.profile(toolId).configAsset(fileName);
    if (shipped === undefined) {
      throw new AssetNotFoundError(`${toolId}/${fileName}`);
    }
    return shipped.content;
  }
}
