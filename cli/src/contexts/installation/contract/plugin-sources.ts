import type { AiToolId } from "../../../shared/domain/tool.js";

/** An installed plugin and the marketplace it was installed from. */
export interface PluginSource {
  readonly toolId: AiToolId;
  readonly plugin: string;
  readonly marketplace: string;
}
