import type { MarketplaceView } from "../../contexts/distribution/contract/marketplace-view.js";
import type { AiToolId } from "../../shared/domain/tool.js";

export interface PluginPickOptions {
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  interactive: boolean;
}

export interface PluginPickResult {
  marketplace: MarketplaceView;
  installed: readonly string[];
}

/** Picking a plugin interactively, as its callers need it: ask, get a choice back. */
export interface PluginPick {
  execute(options: PluginPickOptions): Promise<PluginPickResult>;
}
