import { join } from "node:path";
import type { Manifest } from "../../domain/models/manifest.js";
import { AIDD_DIR } from "../../domain/models/paths.js";
import { AI_TOOL_IDS, type AiToolId } from "../../domain/models/tool-ids.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Prompter } from "../../domain/ports/prompter.js";
import type { MarketplaceRegisterFrameworkUseCase } from "./marketplace/marketplace-register-framework-use-case.js";
import type { PluginInstallFromMarketplaceUseCase } from "./plugin/plugin-install-from-marketplace-use-case.js";

export interface MigrationPlan {
  hasObsoleteScripts: boolean;
  hasObsoletePlugins: boolean;
  bundledPlugins: Map<string, AiToolId[]>;
  obsoleteScriptFiles: string[];
}

export interface MigrateOptions {
  projectRoot: string;
  interactive: boolean;
  dryRun: boolean;
}

export interface MigrateResult {
  kind: "no-op" | "dry-run" | "migrated" | "aborted";
}

export function detectMigrationPlan(manifest: Manifest): MigrationPlan {
  const bundledPlugins = new Map<string, AiToolId[]>();
  for (const toolId of manifest.getInstalledToolIds()) {
    if (!(AI_TOOL_IDS as readonly string[]).includes(toolId)) continue;
    for (const plugin of manifest.getPlugins(toolId)) {
      if (plugin.marketplace !== undefined) continue;
      const existing = bundledPlugins.get(plugin.name) ?? [];
      existing.push(toolId as AiToolId);
      bundledPlugins.set(plugin.name, existing);
    }
  }
  return {
    hasObsoleteScripts: manifest.hasScripts(),
    hasObsoletePlugins: manifest.hasPlugins(),
    bundledPlugins,
    obsoleteScriptFiles: manifest.getScriptsFiles().map((f) => f.relativePath),
  };
}

function isPlanEmpty(plan: MigrationPlan): boolean {
  return !plan.hasObsoleteScripts && !plan.hasObsoletePlugins && plan.bundledPlugins.size === 0;
}

export class MigrateUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly logger: Logger,
    private readonly prompter: Prompter,
    private readonly registerFramework: MarketplaceRegisterFrameworkUseCase,
    private readonly pluginInstall: PluginInstallFromMarketplaceUseCase
  ) {}

  async execute(options: MigrateOptions): Promise<MigrateResult> {
    const manifest = await this.manifestRepo.load();
    if (!manifest) return { kind: "no-op" };
    const plan = detectMigrationPlan(manifest);
    if (isPlanEmpty(plan)) return { kind: "no-op" };
    this.displayPlan(plan);
    if (options.dryRun) return { kind: "dry-run" };
    const confirmed = await this.confirm(options.interactive);
    if (!confirmed) return { kind: "aborted" };
    await this.applyMigration(manifest, plan, options);
    return { kind: "migrated" };
  }

  private async applyMigration(
    manifest: Manifest,
    plan: MigrationPlan,
    options: MigrateOptions
  ): Promise<void> {
    const backupPath = await this.fs.backup(join(options.projectRoot, AIDD_DIR, "manifest.json"));
    this.stripObsoleteEntries(manifest, plan);
    await this.manifestRepo.save(manifest);
    await this.registerFramework.execute({ projectRoot: options.projectRoot });
    await this.rewirePlugins(plan, options);
    await this.offerDiskCleanup(plan, options);
    this.logger.info(`Backup at ${backupPath} — delete when satisfied.`);
  }

  private stripObsoleteEntries(manifest: Manifest, plan: MigrationPlan): void {
    if (plan.hasObsoleteScripts) manifest.clearScripts();
    if (plan.hasObsoletePlugins) manifest.clearPlugins();
    for (const [pluginName, toolIds] of plan.bundledPlugins) {
      for (const toolId of toolIds) {
        manifest.removePlugin(toolId, pluginName);
      }
    }
  }

  private async rewirePlugins(plan: MigrationPlan, options: MigrateOptions): Promise<void> {
    for (const [pluginName, toolIds] of plan.bundledPlugins) {
      try {
        await this.pluginInstall.execute({
          pluginName,
          toolIds,
          projectRoot: options.projectRoot,
          interactive: false,
          autoSelect: true,
        });
      } catch {
        this.logger.warn(`Plugin "${pluginName}" could not be re-installed from marketplace.`);
      }
    }
  }

  private async offerDiskCleanup(plan: MigrationPlan, options: MigrateOptions): Promise<void> {
    if (!options.interactive || plan.obsoleteScriptFiles.length === 0) return;
    const doClean = await this.prompter.confirm(
      `Delete ${plan.obsoleteScriptFiles.length} obsolete script file(s) from disk?`
    );
    if (!doClean) return;
    for (const relPath of plan.obsoleteScriptFiles) {
      const abs = join(options.projectRoot, relPath);
      if (await this.fs.fileExists(abs)) await this.fs.deleteFile(abs);
    }
  }

  private displayPlan(plan: MigrationPlan): void {
    this.logger.info("Migration plan detected:");
    if (plan.hasObsoleteScripts) this.logger.info("  - Strip obsolete scripts section");
    if (plan.hasObsoletePlugins) this.logger.info("  - Strip obsolete top-level plugins section");
    for (const [name, toolIds] of plan.bundledPlugins) {
      this.logger.info(`  - Re-wire plugin "${name}" (tools: ${toolIds.join(", ")})`);
    }
  }

  private async confirm(interactive: boolean): Promise<boolean> {
    if (!interactive) return true;
    return this.prompter.confirm("Apply migration? (A backup will be created first)");
  }
}
