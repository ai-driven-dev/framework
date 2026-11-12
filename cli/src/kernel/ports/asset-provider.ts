import type { ConfigAsset, SchemaName } from "../file.js";
import type { ToolId } from "../tool.js";

export interface AssetProvider {
  loadConfigAsset(toolId: ToolId, fileName: string): ConfigAsset;
  loadSchema(name: SchemaName): object;
}
