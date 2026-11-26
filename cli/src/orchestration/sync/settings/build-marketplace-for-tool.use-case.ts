import type {
  BuiltMarketplaceEnsurer,
  MarketplaceToBuild,
} from "../../../contexts/installation/contract/built-marketplace.js";
import type { ToolCatalog } from "../../../contexts/tools/contract/tool-catalog.js";
import type { ToolId } from "../../../shared/domain/tool.js";
import type { Logger } from "../../../shared/ports/logger.js";

/** Builds the tree a native activation points a tool at. A tree that cannot be built is warned
 * about and left out, so one marketplace never stops the activation of the others. */
export class BuildMarketplaceForTool {
  constructor(
    private readonly ensureBuilt: BuiltMarketplaceEnsurer,
    private readonly logger: Logger,
    private readonly tools: ToolCatalog
  ) {}

  /** The built tree. `null` when the tool is not an AI tool (it has no tree to build), or after
   * a warning when the build failed. */
  async execute(
    toolId: ToolId,
    marketplace: MarketplaceToBuild,
    projectRoot: string
  ): Promise<string | null> {
    if (!this.tools.isAiTool(toolId)) return null;
    // @policy report-and-continue: a tree that cannot be built skips that marketplace only.
    // biome-ignore lint/plugin: a tree that cannot be built skips that marketplace and says so
    try {
      const { builtDir } = await this.ensureBuilt.execute({
        projectRoot,
        marketplace,
        target: toolId,
        mode: "marketplace",
      });
      return builtDir;
    } catch (error) {
      this.logger.warn(
        `Native plugin activation — build '${marketplace.name}' for ${toolId} skipped: `,
        error
      );
      return null;
    }
  }
}
