import type { MigrationPlan } from "../../../domain/models/migration-plan.js";
import type { Logger } from "../../../domain/ports/logger.js";
import type { PluginInstallFromMarketplaceUseCase } from "../plugin/plugin-install-from-marketplace-use-case.js";

export interface MigrateRewirePluginsOptions {
  projectRoot: string;
  plan: MigrationPlan;
}

export class MigrateRewirePluginsUseCase {
  constructor(
    private readonly pluginInstall: PluginInstallFromMarketplaceUseCase,
    private readonly logger: Logger
  ) {}

  async execute(options: MigrateRewirePluginsOptions): Promise<void> {
    for (const plugin of options.plan.pluginsToRewire) {
      await this.rewirePlugin(plugin, options.projectRoot);
    }
  }

  private async rewirePlugin(
    plugin: MigrationPlan["pluginsToRewire"][number],
    projectRoot: string
  ): Promise<void> {
    try {
      await this.pluginInstall.execute({
        pluginName: plugin.name,
        toolIds: [...plugin.toolIds],
        projectRoot,
        interactive: false,
        autoSelect: true,
        fromMarketplace: plugin.marketplace,
      });
    } catch {
      this.logger.warn(`Plugin "${plugin.name}" could not be re-installed from marketplace.`);
    }
  }
}
