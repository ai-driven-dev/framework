import type { ConfigAsset } from "../../../src/shared/domain/config-asset.js";
import type { ToolId } from "../../../src/shared/domain/tool.js";
import type { AssetProvider } from "../../../src/shared/ports/asset-provider.js";

export class StubAssetProvider implements AssetProvider {
  constructor(
    private readonly assets: Readonly<Record<string, ConfigAsset>>,
    private readonly fallback?: AssetProvider
  ) {}

  loadConfigAsset(toolId: ToolId, fileName: string): ConfigAsset {
    const asset = this.assets[`${toolId}/${fileName}`];
    if (asset !== undefined) return asset;
    if (this.fallback === undefined) throw new Error(`no stub asset for ${toolId}/${fileName}`);
    return this.fallback.loadConfigAsset(toolId, fileName);
  }
}
