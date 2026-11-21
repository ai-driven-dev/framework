import type { ConfigAsset, SchemaName } from "../domain/tool.js";

export interface AssetProvider {
  loadConfigAsset(toolId: string, fileName: string): ConfigAsset;
  loadSchema(name: SchemaName): object;
}
