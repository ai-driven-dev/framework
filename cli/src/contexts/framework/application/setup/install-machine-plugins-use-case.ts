import type { Logger } from "../../../../kernel/ports/logger.js";
import type { AiToolId, ToolId } from "../../../../kernel/tool.js";
import type { ResolveMarketplace } from "../../../distribution/application/resolve-marketplace-use-case.js";
import type { PluginCatalogEntry } from "../../../distribution/domain/catalog.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../distribution/domain/marketplace.js";
import type { MarketplaceRegistry } from "../../../distribution/domain/ports/marketplace-registry.js";
import { machineFilesOf } from "../../../tools/domain/registry.js";
import type { Manifest } from "../../domain/manifest.js";
import { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import { resolvePluginSourceFromMarketplace } from "../../domain/plugins/plugin-source-resolver.js";
import type { PluginInstallMode } from "../../domain/setup-flow.js";
import type { UserPluginFileUpdater } from "../ownership/user-plugin-file-updater.js";

export interface InstallMachinePluginsOptions {
  readonly projectRoot: string;
  readonly toolIds: readonly ToolId[];
  readonly mode: PluginInstallMode;
  readonly pluginNames: readonly string[];
}

export interface InstallMachinePluginsResult {
  /** The framework plugins this run chose, which a tool with native activation enables next. */
  readonly plugins: readonly string[];
}

/**
 * `setup --global --plugins …`: picks the framework plugins from the shared source's catalog and
 * copies each one's machine files (OpenCode's skills and agents, Codex's agents) into the tool's
 * user configuration directory, recording them in the machine manifest as user-scope plugins so
 * `plugin update --scope user`, `sync --scope user` and `clean --scope user` own them. A first
 * install is a rebuild of a plugin that owns no file yet, so both go through one writer. A tool
 * that enables plugins through its own CLI is handed the chosen names by the caller instead.
 */
export class InstallMachinePluginsUseCase {
  constructor(
    private readonly registry: Pick<MarketplaceRegistry, "list">,
    private readonly resolveMarketplace: ResolveMarketplace,
    private readonly fileUpdater: Pick<UserPluginFileUpdater, "planUpdate" | "applyUpdate">,
    private readonly logger: Logger
  ) {}

  async execute(
    manifest: Manifest,
    options: InstallMachinePluginsOptions
  ): Promise<InstallMachinePluginsResult> {
    if (options.mode === "none" || options.mode === "interactive") return { plugins: [] };
    const marketplace = (await this.registry.list(options.projectRoot)).find(
      (entry) => entry.name === FRAMEWORK_MARKETPLACE_NAME && entry.scope === "user"
    );
    if (marketplace === undefined) {
      throw new Error(
        "--global --plugins installs from the shared framework source, and none is registered; drop --no-default-marketplace."
      );
    }
    const { catalog, localPath } = await this.resolveMarketplace.execute({
      marketplace,
      projectRoot: options.projectRoot,
    });
    const entries = selectEntries(catalog?.plugins ?? [], options);
    for (const toolId of options.toolIds) {
      if (machineFilesOf(toolId) === null) continue;
      for (const entry of entries) {
        const owned = manifest.getPlugins(toolId).find((plugin) => plugin.name === entry.name);
        const plugin =
          owned ??
          InstalledPlugin.fromMetadata(
            entry.name,
            entry.version ?? "0.0.0",
            resolvePluginSourceFromMarketplace(entry.source, marketplace, localPath),
            entry.strict,
            "user",
            marketplace.name
          );
        await this.install(manifest, toolId as AiToolId, plugin, owned !== undefined, options);
      }
    }
    return { plugins: entries.map((entry) => entry.name) };
  }

  private async install(
    manifest: Manifest,
    toolId: AiToolId,
    plugin: InstalledPlugin,
    owned: boolean,
    options: InstallMachinePluginsOptions
  ): Promise<void> {
    const plan = await this.fileUpdater.planUpdate(
      plugin,
      toolId,
      options.projectRoot,
      this.logger,
      true
    );
    if (plan === null || (plan.files.length === 0 && !owned)) return;
    const next = await this.fileUpdater.applyUpdate(plan, this.logger);
    if (owned) manifest.updatePlugin(toolId, next);
    else manifest.addPlugin(toolId, next);
  }
}

function selectEntries(
  catalog: readonly PluginCatalogEntry[],
  options: InstallMachinePluginsOptions
): readonly PluginCatalogEntry[] {
  if (options.mode === "all") return catalog;
  if (options.mode === "recommended") return catalog.filter((entry) => entry.recommended);
  const missing = options.pluginNames.filter((name) => !catalog.some((e) => e.name === name));
  if (missing.length > 0) {
    throw new Error(`Not in the framework catalog: ${missing.join(", ")}.`);
  }
  return catalog.filter((entry) => options.pluginNames.includes(entry.name));
}
