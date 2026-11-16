import type { ToolId } from "../../../../shared/domain/tool.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { FrameworkBuildTarget } from "../../../translate/contract/build-targets.js";
import type { DeclaredMarketplace } from "../../ports/marketplace-sources.js";
import type { BuiltMarketplaceEnsurer } from "../shared/ensure-built-marketplace.js";

export class BuildMarketplaceForTool {
  constructor(
    private readonly ensureBuilt: BuiltMarketplaceEnsurer,
    private readonly logger: Logger
  ) {}

  /** The built tree, or `null` after a warning when the build failed. */
  async execute(
    toolId: ToolId,
    marketplace: DeclaredMarketplace,
    projectRoot: string
  ): Promise<string | null> {
    try {
      const { builtDir } = await this.ensureBuilt.execute({
        projectRoot,
        marketplace,
        target: toolId as FrameworkBuildTarget,
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
