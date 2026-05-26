import type { ToolId } from "../models/tool-ids.js";

export type ConfigAsset = Record<string, unknown> | readonly unknown[] | string;

export interface DefaultMarketplace {
  readonly name: string;
  readonly source: string;
  readonly type: "git";
}

export interface AssetProvider {
  loadConfigAsset(toolId: ToolId, fileName: string): ConfigAsset;
  loadDefaultMarketplace(): DefaultMarketplace;
  loadPluginManifestSchema(): object;
  loadMarketplaceSchema(): object;
  loadClaudeMarketplaceSchema(): object;
  loadCodexPluginManifestSchema(): object;
}
