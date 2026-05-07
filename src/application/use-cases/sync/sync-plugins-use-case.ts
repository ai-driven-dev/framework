import type { Plugin } from "../../../domain/models/plugin.js";
import type { AiToolId } from "../../../domain/models/tool-ids.js";
import type { Logger } from "../../../domain/ports/logger.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import { NoManifestError } from "../../errors.js";
import type { PluginInstallFromMarketplaceUseCase } from "../plugin/plugin-install-from-marketplace-use-case.js";

export interface SyncPluginsOptions {
  projectRoot: string;
  sourceToolId: AiToolId;
  targetToolIds: AiToolId[];
  force?: boolean;
  interactive?: boolean;
}

export interface SyncPluginsToolResult {
  targetToolId: AiToolId;
  installed: string[];
  skipped: string[];
  warnings: string[];
}

export interface SyncPluginsResult {
  tools: SyncPluginsToolResult[];
  totalInstalled: number;
  totalSkipped: number;
  totalWarnings: number;
}

export class SyncPluginsUseCase {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly pluginInstallFromMarketplace: PluginInstallFromMarketplaceUseCase,
    private readonly logger: Logger
  ) {}

  async execute(options: SyncPluginsOptions): Promise<SyncPluginsResult> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) throw new NoManifestError();
    const sourcePlugins = manifest.getPlugins(options.sourceToolId);
    const toolResults: SyncPluginsToolResult[] = [];
    for (const targetId of options.targetToolIds) {
      const targetPlugins = manifest.getPlugins(targetId);
      const result = await this.syncPluginsForTarget(
        sourcePlugins,
        targetPlugins,
        targetId,
        options
      );
      toolResults.push(result);
    }
    return this.buildTotals(toolResults);
  }

  private async syncPluginsForTarget(
    sourcePlugins: readonly Plugin[],
    targetPlugins: readonly Plugin[],
    targetId: AiToolId,
    options: SyncPluginsOptions
  ): Promise<SyncPluginsToolResult> {
    const result: SyncPluginsToolResult = {
      targetToolId: targetId,
      installed: [],
      skipped: [],
      warnings: [],
    };
    for (const srcPlugin of sourcePlugins) {
      await this.syncOnePlugin(srcPlugin, targetPlugins, targetId, options, result);
    }
    return result;
  }

  private async syncOnePlugin(
    srcPlugin: Plugin,
    targetPlugins: readonly Plugin[],
    targetId: AiToolId,
    options: SyncPluginsOptions,
    result: SyncPluginsToolResult
  ): Promise<void> {
    const existing = targetPlugins.find((p) => p.name === srcPlugin.name);
    if (existing !== undefined && existing.version === srcPlugin.version) {
      result.skipped.push(srcPlugin.name);
      return;
    }
    if (srcPlugin.marketplace === undefined) {
      const msg = `Plugin '${srcPlugin.name}' has no marketplace — cannot propagate to ${targetId}. Add it manually.`;
      this.logger.warn(msg);
      result.warnings.push(msg);
      return;
    }
    await this.installPlugin(srcPlugin, targetId, options, result);
  }

  private async installPlugin(
    srcPlugin: Plugin,
    targetId: AiToolId,
    options: SyncPluginsOptions,
    result: SyncPluginsToolResult
  ): Promise<void> {
    try {
      await this.pluginInstallFromMarketplace.execute({
        pluginName: srcPlugin.name,
        version: srcPlugin.version,
        fromMarketplace: srcPlugin.marketplace,
        toolIds: [targetId],
        projectRoot: options.projectRoot,
        interactive: options.interactive ?? false,
        autoSelect: true,
      });
      result.installed.push(srcPlugin.name);
      this.logger.info(`Installed plugin '${srcPlugin.name}' on ${targetId}`);
    } catch (err) {
      const msg = `Plugin '${srcPlugin.name}' could not be installed on ${targetId}: ${err instanceof Error ? err.message : String(err)}`;
      this.logger.warn(msg);
      result.warnings.push(msg);
    }
  }

  private buildTotals(tools: SyncPluginsToolResult[]): SyncPluginsResult {
    return {
      tools,
      totalInstalled: tools.reduce((s, t) => s + t.installed.length, 0),
      totalSkipped: tools.reduce((s, t) => s + t.skipped.length, 0),
      totalWarnings: tools.reduce((s, t) => s + t.warnings.length, 0),
    };
  }
}
