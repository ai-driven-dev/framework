import type { ToolId } from "../../../../shared/domain/tool.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { UserPluginChoice } from "../../ports/marketplace-sources.js";
import type {
  BoundPluginMaterializer,
  PlannedUserPluginFileUpdate,
} from "../plugin/plugin-materializer.js";

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
    const plans: { readonly plan: PlannedUserPluginFileUpdate; readonly owned: boolean }[] = [];
    for (const toolId of command.toolIds) {
      const tool = this.tools.profile(toolId);
      if (tool.kind !== "ai" || tool.plugins()?.copiesFilesGlobally() !== true) continue;
      for (const { entry, source, marketplaceName } of command.plugins) {
        const owned = manifest.getPlugins(toolId).find((plugin) => plugin.name === entry.name);
        const resolved = InstalledPlugin.fromMetadata(
          entry.name,
          entry.version ?? "0.0.0",
          source,
          entry.strict,
          "user",
          marketplaceName
        );
        const plugin =
          owned === undefined
            ? resolved
            : resolved.withFiles(owned.files).withDependents(owned.dependents);
        const plan = await this.materializer.planUpdate(
          plugin,
          tool,
          command.projectRoot,
          this.logger,
          true
        );
        if (plan === null || (plan.files.length === 0 && owned === undefined)) continue;
        plans.push({ plan, owned: owned !== undefined });
      }
    }
    for (const { plan, owned } of plans) {
      const next = await this.materializer.applyUpdate(plan, this.logger);
      if (owned) manifest.updatePlugin(plan.tool.toolId, next);
      else manifest.addPlugin(plan.tool.toolId, next);
      await this.repo.save(manifest);
    }
  }
}
