import type { ToolId } from "../../../../shared/domain/tool.js";
import type { ServerPluginLedger } from "../../ports/server/server-plugin-ledger.js";

export interface HeldServerPluginsRequest {
  readonly plugins: readonly string[];
  readonly toolIds: readonly ToolId[] | "all";
}

/** Answers whether aidd installed any of these plugins in a host's own server. */
export class HeldServerPlugins {
  constructor(private readonly ledger: Pick<ServerPluginLedger, "load">) {}

  async execute({ plugins, toolIds }: HeldServerPluginsRequest): Promise<boolean> {
    const owned = await this.ledger.load();
    return [...owned].some(
      ([toolId, ids]) =>
        (toolIds === "all" || toolIds.includes(toolId)) &&
        plugins.some((name) => ids.includes(name))
    );
  }
}
