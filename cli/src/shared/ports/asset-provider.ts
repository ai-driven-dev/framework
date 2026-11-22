import type { ConfigAsset } from "../domain/config-asset.js";

export interface AssetProvider {
  loadConfigAsset(toolId: string, fileName: string): ConfigAsset;
}
