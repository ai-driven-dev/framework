import type { Logger } from "../../../../kernel/ports/logger.js";
import type { AiToolId, ToolId } from "../../../../kernel/tool.js";
import type { ResolveMarketplace } from "../../../distribution/application/resolve-marketplace-use-case.js";
import type { PluginCatalogEntry } from "../../../distribution/domain/catalog.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../distribution/domain/marketplace.js";
import type { MarketplaceRegistry } from "../../../distribution/domain/ports/marketplace-registry.js";
import { copiesPluginFilesForMachine } from "../../../tools/domain/registry.js";
import type { Manifest } from "../../domain/manifest.js";
import { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import { resolvePluginSourceFromMarketplace } from "../../domain/plugins/plugin-source-resolver.js";
import type { PluginInstallMode } from "../../domain/setup-flow.js";
import type {
  PlannedUserPluginFileUpdate,
  UserPluginFileUpdater,
} from "../ownership/user-plugin-file-updater.js";

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
 * copies each one's files into the tool's user configuration directory (OpenCode's and Kilo's
 * skills and agents, Codex's agents) or user plugins directory (Cursor), recording them in the machine manifest as user-scope plugins so
 * `plugin update --scope user`, `sync --scope user` and `clean --scope user` own them. A first
 * install is a rebuild of a plugin that owns no file yet, so both go through one writer. A tool
 * that enables plugins through its own CLI is handed the chosen names by the caller instead.
 *
 * Every plan is checked before the first write, and `record` runs after each plugin, so a run that
 * stops part way still owns what it wrote and a later update can replace it.
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
    options: InstallMachinePluginsOptions,
    record: (manifest: Manifest) => Promise<void>
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
    const plans: { readonly plan: PlannedUserPluginFileUpdate; readonly owned: boolean }[] = [];
    for (const toolId of options.toolIds) {
      if (!copiesPluginFilesForMachine(toolId)) continue;
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
        const plan = await this.fileUpdater.planUpdate(
          plugin,
          toolId as AiToolId,
          options.projectRoot,
          this.logger,
          true
        );
        if (plan === null || (plan.files.length === 0 && owned === undefined)) continue;
        plans.push({ plan, owned: owned !== undefined });
      }
    }
    for (const { plan, owned } of plans) {
      const next = await this.fileUpdater.applyUpdate(plan, this.logger);
      if (owned) manifest.updatePlugin(plan.toolId, next);
      else manifest.addPlugin(plan.toolId, next);
      await record(manifest);
    }
    return { plugins: entries.map((entry) => entry.name) };
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
