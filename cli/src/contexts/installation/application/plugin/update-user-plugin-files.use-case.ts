import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { RegistrationRecordRules } from "../../ports/native-host.js";
import type {
  ContainmentCheck,
  PlannedUserPluginFileUpdate,
  UserPluginMaterialization,
} from "../../ports/plugin/user-plugin-materialization.js";
import { resolvePluginToolIds } from "./plugin-target-resolution.js";
import {
  assertSelectionResolves,
  nativeTargets,
  type RefreshNativeRef,
  refreshNativeRefs,
} from "./update-native-refs.js";
import type { UpdatePluginRequest } from "./update-plugin.use-case.js";

/** What a machine-scope update needs beyond the plugins it names. */
export interface UpdateUserPluginFilesRequest extends UpdatePluginRequest {
  readonly isWithinUserScope: ContainmentCheck;
  readonly refreshNative: RefreshNativeRef;
}

/** What UpdateUserPluginFiles is built from. */
export interface UpdateUserPluginFilesDeps {
  readonly repo: ManifestRepository & Lock;
  readonly materializer: UserPluginMaterialization;
  readonly logger: Logger;
  readonly records: RegistrationRecordRules;
}

/** Brings the machine-scope plugins, and the native refs aidd owns, to their latest version. */
export class UpdateUserPluginFiles {
  constructor(
    private readonly deps: UpdateUserPluginFilesDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: UpdateUserPluginFilesRequest): Promise<string[]> {
    const run = () => this.updateLocked(options);
    return this.deps.repo.withExclusiveAccess(run);
  }

  private async updateLocked(options: UpdateUserPluginFilesRequest): Promise<string[]> {
    const loaded = await this.deps.repo.load();
    if (loaded === null)
      throw new Error(
        "No machine manifest: cannot prove AIDD ownership for user-scope plugin update."
      );
    const manifest = Manifest.fromJSON(loaded.toJSON(), (raw) => this.tools.toolId(raw));
    const toolIds = resolvePluginToolIds(options.toolIds, manifest, this.tools);
    const targets = this.fileTargets(manifest, toolIds, options);
    const natives = nativeTargets(this.deps.records, manifest, { toolIds, options });
    assertSelectionResolves(this.deps.records, options, { files: targets.length, native: natives });
    // One plan at a time: plans for one tool share its built tree, which the first one builds.
    const filePlans = [];
    for (const { toolId, plugin } of targets) {
      const plan = await this.deps.materializer.planUpdate({
        plugin,
        tool: this.tools.aiProfile(toolId),
        projectRoot: options.projectRoot,
        logger: this.deps.logger,
        rebuild: options.rebuild === true,
        isWithinUserScope: options.isWithinUserScope,
      });
      filePlans.push({ toolId, plugin, plan });
    }
    const updated = await refreshNativeRefs(this.deps.logger, this.tools, {
      targets: natives,
      options,
    });
    for (const { toolId, plugin, plan } of filePlans) {
      if (plan === null) continue;
      manifest.updatePlugin(toolId, await this.applyFilePlan({ toolId, plugin, plan }, options));
      updated.push(plugin.name);
    }
    if (updated.length > 0) await this.deps.repo.save(manifest);
    return updated;
  }

  private fileTargets(
    manifest: Manifest,
    toolIds: readonly AiToolId[],
    options: UpdatePluginRequest
  ) {
    return toolIds.flatMap((toolId) =>
      manifest
        .getPlugins(toolId)
        .filter(
          (plugin) =>
            plugin.scope === "user" &&
            (options.pluginNames === undefined || options.pluginNames.includes(plugin.name))
        )
        .map((plugin) => ({ toolId, plugin }))
    );
  }

  private async applyFilePlan(
    planned: { toolId: AiToolId; plugin: InstalledPlugin; plan: PlannedUserPluginFileUpdate },
    options: UpdateUserPluginFilesRequest
  ): Promise<InstalledPlugin> {
    const { toolId, plugin, plan } = planned;
    if (plugin.dependents.length > 0)
      this.deps.logger.warn(
        `${toolId}: updating user-scope '${plugin.name}' affects ${plugin.dependents.join(", ")}; each project must refresh its own integration afterward.`
      );
    try {
      return await this.deps.materializer.applyUpdate(plan, {
        logger: this.deps.logger,
        isWithinUserScope: options.isWithinUserScope,
      });
    } catch (error) {
      throw new Error(
        `${toolId}: user plugin file update failed after preflight; a native ref may already have been updated and file bytes may be partial. Canonical claim not saved; reconcile manually before retrying.`,
        { cause: error }
      );
    }
  }
}
