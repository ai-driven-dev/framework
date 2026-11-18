import {
  ActiveMachineDependentsError,
  PluginNotFoundError,
} from "../../../../shared/domain/errors.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { HostWithdrawal, RegistrationRecordRules } from "../../ports/native-host.js";
import { resolvePluginToolIds } from "../plugin/plugin-target-resolution.js";
import { requireManifest } from "../shared/require-manifest.js";
import type { UserScopePluginFiles } from "./user-scope-plugin-files.js";

export interface UserPluginRemoveOptions {
  pluginName: string;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  /** The home directory the plugin's files are proven under. */
  home: string;
}

/** Removes a machine-scope plugin, serialised through the machine manifest. */
export class RemoveUserPlugin<Proof> {
  constructor(
    private readonly userRepo: ManifestRepository & Lock,
    private readonly withdrawFromHost: HostWithdrawal<Proof>,
    private readonly records: RegistrationRecordRules,
    private readonly userScopePluginFiles: UserScopePluginFiles,
    private readonly tools: ToolCatalog
  ) {}

  execute(options: UserPluginRemoveOptions): Promise<void> {
    return this.userRepo.withExclusiveAccess(() => this.removeUserPlugin(options));
  }

  private async removeUserPlugin(options: UserPluginRemoveOptions): Promise<void> {
    const repo = this.userRepo;
    const manifest = await requireManifest(repo);
    const toolIds = resolvePluginToolIds(options.toolIds, manifest, this.tools);
    const targets = toolIds.flatMap((toolId) => {
      const plugin = manifest
        .getPlugins(toolId)
        .find((p) => p.name === options.pluginName && p.scope === "user");
      return plugin === undefined ? [] : [{ toolId, plugin }];
    });
    const nativeTargets = toolIds.flatMap((toolId) => {
      const registrations = manifest.getNativeRegistrations(toolId);
      if (registrations === undefined) return [];
      return (registrations.pluginClaims ?? [])
        .filter((claim) => this.records.refSelectedBy(claim.ref, options.pluginName))
        .map((claim) => ({ toolId, registrations, claim }));
    });
    if (targets.length === 0 && nativeTargets.length === 0)
      throw new PluginNotFoundError(options.pluginName);
    if (!this.records.isQualifiedRef(options.pluginName) && nativeTargets.length > 1) {
      throw new Error(
        `Native plugin '${options.pluginName}' has multiple catalogues; use the exact <plugin>@<catalogue> ref.`
      );
    }
    const dependents = [
      ...new Set([
        ...targets.flatMap(({ plugin }) => plugin.dependents),
        ...nativeTargets.flatMap(({ claim }) => claim.dependents),
      ]),
    ];
    if (dependents.length > 0) {
      throw new ActiveMachineDependentsError(
        `user-scope plugin '${options.pluginName}'`,
        dependents
      );
    }
    const safeFiles = await Promise.all(
      targets.map(async ({ toolId, plugin }) => {
        const files = await this.userScopePluginFiles.proven(
          plugin,
          this.tools.aiProfile(toolId),
          options.home
        );
        if (files.size !== plugin.files.size)
          throw new Error(
            `Refusing partial removal of user-scope plugin '${plugin.name}': a tracked file escaped its boundary.`
          );
        return { toolId, plugin, files };
      })
    );
    const nativeRemoval = await Promise.all(
      nativeTargets.map(async ({ toolId, registrations, claim }) => ({
        toolId,
        registrations,
        claim,
        proven: await this.withdrawFromHost.proveClaimedRef(
          registrations,
          { tool: toolId, ref: claim.ref },
          options.projectRoot
        ),
      }))
    );
    for (const target of nativeRemoval) {
      this.withdrawFromHost.uninstallProven(target.proven);
      manifest.setNativeRegistrations(
        target.toolId,
        this.records.withoutClaimedRef(target.registrations, target.claim.ref)
      );
    }
    for (const { toolId, plugin, files } of safeFiles) {
      await this.userScopePluginFiles.remove(
        files,
        this.tools.aiProfile(toolId),
        options.projectRoot
      );
      manifest.removePlugin(toolId, plugin.name);
    }
    await repo.save(manifest);
  }
}
