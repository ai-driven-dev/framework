import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { DeclaredMarketplace } from "../../ports/marketplace-sources.js";
import type { BuiltMarketplaceEnsurer } from "../shared/ensure-built-marketplace.js";

export class BuildMarketplaceForTool {
  constructor(
    private readonly ensureBuilt: BuiltMarketplaceEnsurer,
    private readonly logger: Logger,
    private readonly tools: ToolCatalog
  ) {}

  /** `null` when the tool is not an AI tool (it has no tree to build) or when the build failed. */
  async forTool(
    toolId: ToolId,
    marketplace: DeclaredMarketplace,
    projectRoot: string
  ): Promise<string | null> {
    return this.tools.isAiTool(toolId) ? this.execute(toolId, marketplace, projectRoot) : null;
  }

  /** The built tree, or `null` after a warning when the build failed. */
  async execute(
    toolId: AiToolId,
    marketplace: DeclaredMarketplace,
    projectRoot: string
  ): Promise<string | null> {
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
        `Native plugin activation — build '${marketplace.name}' for ${toolId} skipped: ${(error as Error).message}`
      );
      return null;
    }
  }
}
