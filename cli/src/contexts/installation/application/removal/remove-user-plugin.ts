import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import {
  ActiveMachineDependentsError,
  PluginNotFoundError,
} from "../../domain/installation.error.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { HostWithdrawal, RegistrationRecordRules } from "../../ports/native-host.js";
import type { UserScopePluginFileRemoval } from "../../ports/user-scope-plugin-files.js";
import { resolvePluginToolIds } from "../plugin/plugin-target-resolution.js";
import { requireManifest } from "../shared/require-manifest.js";

export interface UserPluginRemoveOptions {
  pluginName: string;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  /** The home directory the plugin's files are proven under. */
  home: string;
}

type FileTargets = ReturnType<RemoveUserPlugin<unknown>["fileTargets"]>;
type NativeTargets = ReturnType<RemoveUserPlugin<unknown>["nativeTargets"]>;

/** What RemoveUserPlugin is built from. */
export interface RemoveUserPluginDeps<Proof> {
  readonly userRepo: ManifestRepository & Lock;
  readonly withdrawFromHost: Pick<HostWithdrawal<Proof>, "proveClaimedRef" | "uninstallProven">;
  readonly records: RegistrationRecordRules;
  readonly userScopePluginFiles: UserScopePluginFileRemoval;
}

/** Removes a machine-scope plugin, serialised through the machine manifest. */
export class RemoveUserPlugin<Proof> {
  constructor(
    private readonly deps: RemoveUserPluginDeps<Proof>,
    private readonly tools: ToolCatalog
  ) {}

  execute(options: UserPluginRemoveOptions): Promise<void> {
    return this.deps.userRepo.withExclusiveAccess(() => this.removeUserPlugin(options));
  }

  private async removeUserPlugin(options: UserPluginRemoveOptions): Promise<void> {
    const manifest = await requireManifest(this.deps.userRepo);
    const toolIds = resolvePluginToolIds(options.toolIds, manifest, this.tools);
    const targets = this.fileTargets(manifest, toolIds, options);
    const nativeTargets = this.nativeTargets(manifest, toolIds, options);
    this.assertRemovable(options, targets, nativeTargets);
    const safeFiles = await this.proveFiles(targets, options);
    const nativeRemoval = await this.proveNativeRefs(nativeTargets, options);
    for (const target of nativeRemoval) {
      await this.deps.withdrawFromHost.uninstallProven(target.proven);
      manifest.setNativeRegistrations(
        target.toolId,
        this.deps.records.withoutClaimedRef(target.registrations, target.claim.ref)
      );
    }
    for (const { toolId, plugin, files } of safeFiles) {
      await this.deps.userScopePluginFiles.remove(
        files,
        this.tools.aiProfile(toolId),
        options.projectRoot
      );
      manifest.removePlugin(toolId, plugin.name);
    }
    await this.deps.userRepo.save(manifest);
  }

  private fileTargets(
    manifest: Manifest,
    toolIds: readonly AiToolId[],
    options: UserPluginRemoveOptions
  ) {
    return toolIds.flatMap((toolId) => {
      const plugin = manifest
        .getPlugins(toolId)
        .find((p) => p.name === options.pluginName && p.scope === "user");
      return plugin === undefined ? [] : [{ toolId, plugin }];
    });
  }

  private nativeTargets(
    manifest: Manifest,
    toolIds: readonly AiToolId[],
    options: UserPluginRemoveOptions
  ) {
    return toolIds.flatMap((toolId) => {
      const registrations = manifest.getNativeRegistrations(toolId);
      if (registrations === undefined) return [];
      return (registrations.pluginClaims ?? [])
        .filter((claim) => this.deps.records.refSelectedBy(claim.ref, options.pluginName))
        .map((claim) => ({ toolId, registrations, claim }));
    });
  }

  private assertRemovable(
    options: UserPluginRemoveOptions,
    targets: FileTargets,
    nativeTargets: NativeTargets
  ): void {
    if (targets.length === 0 && nativeTargets.length === 0)
      throw new PluginNotFoundError(options.pluginName);
    if (!this.deps.records.isQualifiedRef(options.pluginName) && nativeTargets.length > 1) {
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
  }

  private proveFiles(targets: FileTargets, options: UserPluginRemoveOptions) {
    return Promise.all(
      targets.map(async ({ toolId, plugin }) => {
        const files = await this.deps.userScopePluginFiles.proven(
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
  }

  private proveNativeRefs(nativeTargets: NativeTargets, options: UserPluginRemoveOptions) {
    return Promise.all(
      nativeTargets.map(async ({ toolId, registrations, claim }) => ({
        toolId,
        registrations,
        claim,
        proven: await this.deps.withdrawFromHost.proveClaimedRef(
          registrations,
          { tool: toolId, ref: claim.ref },
          options.projectRoot
        ),
      }))
    );
  }
}
