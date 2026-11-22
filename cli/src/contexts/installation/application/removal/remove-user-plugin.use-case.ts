import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import {
  ActiveMachineDependentsError,
  PluginNotFoundError,
} from "../../domain/installation.error.js";
import type { NativeRegistrations } from "../../domain/manifest/native-registrations.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { UserScopePluginFileRemoval } from "../../ports/user-scope-plugin-files.js";
import { resolvePluginToolIds } from "../plugin/plugin-target-resolution.js";
import type { RefSelection } from "../plugin/update-native-refs.js";
import { requireManifest } from "../shared/require-manifest.js";
import type { ClaimedRefWithdrawal } from "./project-plugin-withdrawal.js";

/** How a machine-scope removal selects and drops a claimed native ref: the host registration's to answer. */
export interface ClaimedRefRecords extends RefSelection {
  withoutClaimedRef(record: NativeRegistrations, ref: string): NativeRegistrations;
}

export interface RemoveUserPluginRequest {
  pluginName: string;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  /** The home directory the plugin's files are proven under. */
  home: string;
  records: ClaimedRefRecords;
}

type FileTargets = ReturnType<RemoveUserPlugin<unknown>["fileTargets"]>;
type NativeTargets = ReturnType<RemoveUserPlugin<unknown>["nativeTargets"]>;

/** What RemoveUserPlugin is built from. */
export interface RemoveUserPluginDeps<Proof> {
  readonly userRepo: ManifestRepository & Lock;
  readonly withdrawFromHost: ClaimedRefWithdrawal<Proof>;
  readonly userScopePluginFiles: UserScopePluginFileRemoval;
}

/** Removes a machine-scope plugin, serialised through the machine manifest. */
export class RemoveUserPlugin<Proof> {
  constructor(
    private readonly deps: RemoveUserPluginDeps<Proof>,
    private readonly tools: ToolCatalog
  ) {}

  execute(options: RemoveUserPluginRequest): Promise<void> {
    return this.deps.userRepo.withExclusiveAccess(() => this.removeUserPlugin(options));
  }

  private async removeUserPlugin(options: RemoveUserPluginRequest): Promise<void> {
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
        options.records.withoutClaimedRef(target.registrations, target.claim.ref)
      );
    }
    for (const { toolId, plugin, files } of safeFiles) {
      await this.deps.userScopePluginFiles.remove(files, this.tools.aiProfile(toolId), {
        projectRoot: options.projectRoot,
        home: options.home,
      });
      manifest.removePlugin(toolId, plugin.name);
    }
    await this.deps.userRepo.save(manifest);
  }

  private fileTargets(
    manifest: Manifest,
    toolIds: readonly AiToolId[],
    options: RemoveUserPluginRequest
  ) {
    return toolIds.flatMap((toolId) => {
      const recorded = manifest
        .getRecordedPlugins(toolId)
        .find((p) => p.plugin.name === options.pluginName && p.plugin.scope === "user");
      return recorded === undefined
        ? []
        : [{ toolId, plugin: recorded.plugin, dependents: options.records.dependentsOf(recorded) }];
    });
  }

  private nativeTargets(
    manifest: Manifest,
    toolIds: readonly AiToolId[],
    options: RemoveUserPluginRequest
  ) {
    return toolIds.flatMap((toolId) => {
      const registrations = manifest.getNativeRegistrations(toolId);
      if (registrations === undefined) return [];
      return options.records
        .claimsOf(registrations)
        .filter((claim) => options.records.refSelectedBy(claim.ref, options.pluginName))
        .map((claim) => ({ toolId, registrations, claim }));
    });
  }

  private assertRemovable(
    options: RemoveUserPluginRequest,
    targets: FileTargets,
    nativeTargets: NativeTargets
  ): void {
    if (targets.length === 0 && nativeTargets.length === 0)
      throw new PluginNotFoundError(options.pluginName);
    if (!options.records.isQualifiedRef(options.pluginName) && nativeTargets.length > 1) {
      throw new Error(
        `Native plugin '${options.pluginName}' has multiple catalogues; use the exact <plugin>@<catalogue> ref.`
      );
    }
    const dependents = [
      ...new Set([
        ...targets.flatMap((target) => target.dependents),
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

  private proveFiles(targets: FileTargets, options: RemoveUserPluginRequest) {
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

  private proveNativeRefs(nativeTargets: NativeTargets, options: RemoveUserPluginRequest) {
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
