import type { AiToolId, ToolId } from "../models/tool-ids.js";

export type ConfigAsset = Record<string, unknown> | readonly unknown[] | string;

export interface MemoryStub {
  readonly fileName: string;
  readonly content: string;
}

export interface DefaultMarketplace {
  readonly name: string;
  readonly source: string;
  readonly type: "git";
}

export interface AssetProvider {
  loadConfigAsset(toolId: ToolId, fileName: string): ConfigAsset;
  loadMemoryStub(toolId: AiToolId): MemoryStub;
  loadDefaultMarketplace(): DefaultMarketplace;
}
