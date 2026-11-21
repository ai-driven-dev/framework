import type { ToolId } from "../../../../shared/domain/tool.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../domain/manifest.js";
import { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { UserPluginChoice } from "../../ports/marketplace-sources.js";
import type {
  BoundPluginMaterializer,
  PlannedUserPluginFileUpdate,
} from "../../ports/plugin/user-plugin-materialization.js";

export interface InstallUserPluginsCommand {
  readonly projectRoot: string;
  readonly toolIds: readonly ToolId[];
  /** The plugins to copy, each with the source it resolved to. */
  readonly plugins: readonly UserPluginChoice[];
}

/**
 * Copies each chosen plugin's files into the tool's user configuration directory (OpenCode's and
 * Kilo's skills and agents, Codex's agents) or user plugins directory (Cursor), recording them in
 * the machine manifest as user-scope plugins so `plugin update --scope user`, `sync --scope user`
 * and `clean --scope user` own them. A first install is a rebuild of a plugin that owns no file
 * yet, so both go through one writer. A tool that enables plugins through its own CLI is left to
 * the caller.
 *
 * Every plan is checked before the first write, and the manifest is saved after each plugin, so a
 * run that stops part way still owns what it wrote and a later update can replace it. The caller
 * holds the machine lock.
 */
export class InstallUserPlugins {
  constructor(
    private readonly repo: ManifestRepository,
    private readonly materializer: BoundPluginMaterializer,
    private readonly logger: Logger,
    private readonly tools: ToolCatalog
  ) {}

  async execute(command: InstallUserPluginsCommand): Promise<void> {
    const manifest = await this.repo.load();
    if (manifest === null) {
      throw new Error("No machine manifest: cannot record the user-scope plugins it installs.");
    }
    const plans: PlannedUserPluginFileUpdate[] = [];
    for (const toolId of command.toolIds) {
      plans.push(...(await this.planTool(toolId, manifest, command)));
    }
    for (const plan of plans) {
      const next = await this.materializer.applyUpdate(plan, this.logger);
      manifest.withPlugin(plan.tool.toolId, next);
      await this.repo.save(manifest);
    }
  }

  private async planTool(
    toolId: ToolId,
    manifest: Manifest,
    command: InstallUserPluginsCommand
  ): Promise<PlannedUserPluginFileUpdate[]> {
    const tool = this.tools.profile(toolId);
    if (tool.kind !== "ai" || tool.plugins()?.copiesFilesGlobally() !== true) return [];
    const plans: PlannedUserPluginFileUpdate[] = [];
    for (const choice of command.plugins) {
      const owned = manifest.getPlugins(toolId).find((plugin) => plugin.name === choice.entry.name);
      const plan = await this.materializer.planUpdate({
        plugin: this.resolvedPlugin(choice, owned),
        tool,
        projectRoot: command.projectRoot,
        logger: this.logger,
        rebuild: true,
      });
      if (plan === null || (plan.files.length === 0 && owned === undefined)) continue;
      plans.push(plan);
    }
    return plans;
  }

  private resolvedPlugin(
    { entry, source, marketplaceName }: UserPluginChoice,
    owned: InstalledPlugin | undefined
  ): InstalledPlugin {
    const resolved = InstalledPlugin.fromMetadata({
      name: entry.name,
      version: entry.version ?? "0.0.0",
      source,
      strict: entry.strict,
      scope: "user",
      marketplace: marketplaceName,
    });
    return owned === undefined
      ? resolved
      : resolved.withFiles(owned.files).withDependents(owned.dependents);
  }
}
