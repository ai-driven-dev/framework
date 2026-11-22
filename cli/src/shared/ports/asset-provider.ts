import type { ConfigAsset } from "../domain/reading/config-asset.js";

export interface AssetProvider {
  loadConfigAsset(toolId: string, fileName: string): ConfigAsset;
}
