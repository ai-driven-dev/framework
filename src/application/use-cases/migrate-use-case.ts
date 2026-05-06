import { join } from "node:path";
import type { Manifest } from "../../domain/models/manifest.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../domain/models/marketplace.js";
import { MigrationPlan, type PluginToRewire } from "../../domain/models/migration-plan.js";
import { AIDD_DIR } from "../../domain/models/paths.js";
import { AI_TOOL_IDS, type AiToolId } from "../../domain/models/tool-ids.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { MarketplaceRegistry } from "../../domain/ports/marketplace-registry.js";
import type { Prompter } from "../../domain/ports/prompter.js";
import type { MarketplaceRegisterFrameworkUseCase } from "./marketplace/marketplace-register-framework-use-case.js";
import type { MigrateBackupUseCase } from "./migrate/migrate-backup-use-case.js";
import type { MigrateRewirePluginsUseCase } from "./migrate/migrate-rewire-plugins-use-case.js";
import type { MigrateStripDeadFilesUseCase } from "./migrate/migrate-strip-dead-files-use-case.js";

export interface MigrateOptions {
  projectRoot: string;
  interactive: boolean;
  dryRun: boolean;
}

export interface MigrateResult {
  kind: "no-op" | "dry-run" | "migrated" | "aborted";
  plan?: MigrationPlan;
}

export class MigrateUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly logger: Logger,
    private readonly prompter: Prompter,
    private readonly registerFramework: MarketplaceRegisterFrameworkUseCase,
    private readonly migrateBackup: MigrateBackupUseCase,
    private readonly migrateStripDeadFiles: MigrateStripDeadFilesUseCase,
    private readonly migrateRewirePlugins: MigrateRewirePluginsUseCase,
    private readonly marketplaceRegistry?: MarketplaceRegistry
  ) {}

  async execute(options: MigrateOptions): Promise<MigrateResult> {
    const raw = await this.loadRaw(options.projectRoot);
    if (raw === null) return { kind: "no-op" };
    const registryHasDefault = await this.checkRegistryForDefault(options.projectRoot);
    const plan = computeMigrationPlan(raw, registryHasDefault);
    if (plan.isNoOp()) return { kind: "no-op" };
    if (options.dryRun) return { kind: "dry-run", plan };
    const confirmed = await this.confirm(options.interactive);
    if (!confirmed) return { kind: "aborted" };
    await this.applyMigration(options, plan);
    return { kind: "migrated", plan };
  }

  private async loadRaw(projectRoot: string): Promise<Record<string, unknown> | null> {
    const manifestPath = join(projectRoot, AIDD_DIR, "manifest.json");
    if (!(await this.fs.fileExists(manifestPath))) return null;
    const content = await this.fs.readFile(manifestPath);
    return JSON.parse(content) as Record<string, unknown>;
  }

  private async checkRegistryForDefault(projectRoot: string): Promise<boolean> {
    if (this.marketplaceRegistry === undefined) return false;
    const list = await this.marketplaceRegistry.list(projectRoot);
    return list.some((m) => m.name === FRAMEWORK_MARKETPLACE_NAME);
  }

  private async applyMigration(options: MigrateOptions, plan: MigrationPlan): Promise<void> {
    const backupPath = await this.migrateBackup.execute({ projectRoot: options.projectRoot });
    this.logger.info(`Backup created at ${backupPath}`);
    await this.migrateStripDeadFiles.execute({ projectRoot: options.projectRoot, plan });
    await this.registerDefaultMarketplace(options, plan);
    await this.migrateRewirePlugins.execute({ projectRoot: options.projectRoot, plan });
    await this.saveMigratedManifest(plan);
  }

  private async registerDefaultMarketplace(
    options: MigrateOptions,
    plan: MigrationPlan
  ): Promise<void> {
    if (!plan.defaultMarketplaceMissing) return;
    await this.registerFramework.execute({ projectRoot: options.projectRoot });
  }

  private async saveMigratedManifest(plan: MigrationPlan): Promise<void> {
    const manifest = await this.manifestRepo.load();
    if (!manifest) return;
    this.stripBundledPlugins(manifest, plan);
    await this.manifestRepo.save(manifest);
  }

  private stripBundledPlugins(manifest: Manifest, plan: MigrationPlan): void {
    const toStrip = new Set(plan.pluginsToRewire.map((p) => p.name));
    for (const toolId of manifest.getInstalledToolIds()) {
      if (!(AI_TOOL_IDS as readonly string[]).includes(toolId)) continue;
      for (const plugin of [...manifest.getPlugins(toolId as AiToolId)]) {
        if (plugin.marketplace === undefined && toStrip.has(plugin.name)) {
          manifest.removePlugin(toolId as AiToolId, plugin.name);
        }
      }
    }
  }

  private async confirm(interactive: boolean): Promise<boolean> {
    if (!interactive) return true;
    return this.prompter.confirm("Apply migration? (A backup will be created first)");
  }
}

// --- Pure plan computation (no I/O) ---

const USER_MEMORY_FILES: readonly string[] = ["CLAUDE.md", "AGENTS.md", "copilot-instructions.md"];
const LEGACY_TOP_LEVEL_FIELDS: readonly string[] = [
  "docs",
  "mode",
  "repo",
  "docsDir",
  "scripts",
  "plugins",
];

export function computeMigrationPlan(
  raw: Record<string, unknown>,
  registryHasDefault = false
): MigrationPlan {
  const fromVersion = typeof raw.version === "number" ? raw.version : 0;
  const fieldsToStrip = detectFieldsToStrip(raw);
  const filesToDelete = collectLegacyFiles(raw);
  const pluginsToRewire = detectBundledPlugins(raw);
  const defaultMarketplaceMissing = !registryHasDefault && !hasDefaultMarketplace(raw);
  return new MigrationPlan({
    fromVersion,
    fieldsToStrip,
    filesToDelete,
    pluginsToRewire,
    defaultMarketplaceMissing,
    userMemoryFiles: [...USER_MEMORY_FILES],
  });
}

function detectFieldsToStrip(raw: Record<string, unknown>): string[] {
  return LEGACY_TOP_LEVEL_FIELDS.filter((f) => f in raw && raw[f] !== undefined && raw[f] !== null);
}

function collectLegacyFiles(raw: Record<string, unknown>): string[] {
  const files: string[] = [];
  for (const section of ["scripts", "plugins"] as const) {
    const entry = raw[section];
    if (entry && typeof entry === "object" && "files" in entry) {
      const rawFiles = (entry as { files: unknown }).files;
      if (Array.isArray(rawFiles)) {
        for (const f of rawFiles) {
          if (
            f &&
            typeof f === "object" &&
            "relativePath" in f &&
            typeof f.relativePath === "string"
          ) {
            files.push(f.relativePath);
          }
        }
      }
    }
  }
  return files;
}

function detectBundledPlugins(raw: Record<string, unknown>): PluginToRewire[] {
  const map = new Map<string, AiToolId[]>();
  const tools = raw.tools as
    | Record<string, { plugins?: Array<{ name: string; marketplace?: string }> }>
    | undefined;
  if (!tools) return [];
  for (const [toolId, entry] of Object.entries(tools)) {
    if (!(AI_TOOL_IDS as readonly string[]).includes(toolId)) continue;
    for (const plugin of entry.plugins ?? []) {
      if (plugin.marketplace !== undefined) continue;
      const existing = map.get(plugin.name) ?? [];
      existing.push(toolId as AiToolId);
      map.set(plugin.name, existing);
    }
  }
  return [...map.entries()].map(([name, toolIds]) => ({
    name,
    marketplace: FRAMEWORK_MARKETPLACE_NAME,
    toolIds,
  }));
}

function hasDefaultMarketplace(raw: Record<string, unknown>): boolean {
  const marketplaces = raw.marketplaces as Record<string, unknown> | undefined;
  if (!marketplaces) return false;
  return FRAMEWORK_MARKETPLACE_NAME in marketplaces;
}
