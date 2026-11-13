import type { ConfigAsset, SchemaName } from "../domain/file.js";
import type { ToolId } from "../domain/tool.js";

export interface AssetProvider {
  loadConfigAsset(toolId: ToolId, fileName: string): ConfigAsset;
  loadSchema(name: SchemaName): object;
}
