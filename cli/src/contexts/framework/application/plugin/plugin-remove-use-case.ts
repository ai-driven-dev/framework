import { homedir as nodeHomedir } from "node:os";
import { dirname, join } from "node:path";
import {
  ActiveMachineDependentsError,
  PluginNotFoundError,
} from "../../../../shared/domain/errors.js";
import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { MarketplaceRegistry } from "../../../distribution/ports/marketplace-registry.js";
import type { WithdrawFromHost } from "../../../host-registration/application/withdraw-from-host.js";
import { assertProjectPathWithinRoot } from "../../../installation/application/ownership/project-path-boundary.js";
import {
  deletePluginFilesForTool,
  loadPluginManifest,
} from "../../../installation/application/plugin/plugin-helpers.js";
import {
  resolveBaseDirFromRecord,
  resolvePluginToolIds,
} from "../../../installation/application/plugin/plugin-target-resolution.js";
import { assertProjectMcpEntriesRemovable } from "../../../installation/application/plugin/remove-project-plugin.js";
import {
  assertProjectHooksRemovable,
  removeProjectHooks,
} from "../../../installation/application/shared/remove-project-hooks.js";
import type { NativeRegistrations } from "../../../installation/domain/manifest/native-registrations.js";
import type { Manifest } from "../../../installation/domain/manifest.js";
import type { InstalledPlugin } from "../../../installation/domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../../installation/ports/manifest-repository.js";
import {
  detachNativePluginRefs,
  isMachineOwnedNativeRef,
} from "../../../machine-claims/application/native-plugin-ownership.js";
import {
  describeGuardedPluginRefMessage,
  frameworkSourceIsShared,
  otherProjectsReferencing,
  refAnotherProjectStillNeeds,
  resolveProjectRootForReferences,
  toleratingUnreadableSourceReferences,
} from "../../../machine-claims/application/shared-source-reference-support.js";
import { detachUserPlugin } from "../../../machine-claims/application/user-plugin-ownership.js";
import { userScopeFilesSafeToDelete } from "../../../machine-claims/application/user-scope-plugin-files.js";
import type { UserSourceReferences } from "../../../machine-claims/ports/user-source-references.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import { resolveHomeDir } from "../../domain/reading/home-dir.js";
import { resolveCacheCandidate } from "../shared/purge-declared-cache.js";

export interface PluginRemoveOptions {
  pluginName: string;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  tools: ToolCatalog;
  scope?: "project" | "user";
}

export class PluginRemoveUseCase {
  constructor(
    private readonly fs: FileWriter & FileReader,
    private readonly manifestRepo: ManifestRepository,
    private readonly logger: Logger,
    private readonly withdrawFromHost: WithdrawFromHost,
    /** The registry of projects referencing the shared machine-scope source, needed for the
     * guard: uninstalling a ref a host enables machine-wide (codex, copilot) would disable it for
     * another project on this machine too. Absent skips the guard entirely. */
    private readonly userSourceReferences?: UserSourceReferences,
    /** Resolves the scope this project's own registry recorded for `plugin.marketplace` — the one
     * fact `frameworkSourceIsShared` needs and a plugin record does not carry. Absent treats every
     * marketplace as not shared. */
    private readonly marketplaceRegistry?: MarketplaceRegistry,
    private readonly userManifestRepo?: ManifestRepository & Lock
  ) {}

  async execute(options: PluginRemoveOptions): Promise<void> {
    if (options.scope === "user") {
      if (this.userManifestRepo === undefined)
        throw new Error("User manifest repository is required for user-scope plugin removal.");
      return this.userManifestRepo.withExclusiveAccess(() => this.removeUserPlugin(options));
    }
    const { pluginName, toolIds, projectRoot, tools } = options;
    const manifest = await loadPluginManifest(this.manifestRepo);
    const resolvedToolIds = resolvePluginToolIds(toolIds, manifest, tools);
    for (const toolId of resolvedToolIds) {
      const plugin = manifest.getPlugins(toolId).find((p) => p.name === pluginName);
      if (plugin === undefined) continue;
      await assertProjectMcpEntriesRemovable(this.fs, plugin, tools.aiProfile(toolId), projectRoot);
      await assertProjectHooksRemovable(this.fs, plugin, tools.aiProfile(toolId), projectRoot);
      if (plugin.marketplace !== undefined)
        await this.withdrawFromHost.assertProjectSource({
          tool: tools.aiProfile(toolId),
          plugin: { name: plugin.name, marketplace: plugin.marketplace, scope: plugin.scope },
          projectRoot,
          registrations: manifest.getNativeRegistrations(toolId),
          isMachineOwned: (ref) => isMachineOwnedNativeRef(this.userManifestRepo, toolId, ref),
        });
    }
    const userTools = resolvedToolIds.filter((toolId) =>
      manifest.getPlugins(toolId).some((p) => p.name === pluginName && p.scope === "user")
    );
    const nativeRefs = new Map<ToolId, readonly string[]>();
    for (const toolId of resolvedToolIds) {
      const plugin = manifest.getPlugins(toolId).find((p) => p.name === pluginName);
      const registrations = manifest.getNativeRegistrations(toolId);
      if (plugin?.marketplace === undefined || registrations === undefined) continue;
      const hostName = registrations.marketplaces.find(
        (m) => m.alias === plugin.marketplace
      )?.hostName;
      if (hostName !== undefined) nativeRefs.set(toolId, [`${pluginName}@${hostName}`]);
    }
    const removed = await this.removeFromTools(
      pluginName,
      resolvedToolIds,
      tools,
      projectRoot,
      manifest
    );
    if (!removed) throw new PluginNotFoundError(pluginName);
    await this.manifestRepo.save(manifest);
    await detachNativePluginRefs(this.userManifestRepo, this.fs, projectRoot, nativeRefs);
    for (const toolId of userTools) {
      await detachUserPlugin(this.userManifestRepo, this.fs, toolId, pluginName, projectRoot);
    }
  }

  private async removeUserPlugin(options: PluginRemoveOptions): Promise<void> {
    const repo = this.userManifestRepo;
    if (repo === undefined)
      throw new Error("User manifest repository is required for user-scope plugin removal.");
    const manifest = await loadPluginManifest(repo);
    const toolIds = resolvePluginToolIds(options.toolIds, manifest, options.tools);
    const targets = toolIds.flatMap((toolId) => {
      const plugin = manifest
        .getPlugins(toolId)
        .find((p) => p.name === options.pluginName && p.scope === "user");
      return plugin === undefined ? [] : [{ toolId, plugin }];
    });
    const nativeTargets = toolIds.flatMap((toolId) => {
      const registrations = manifest.getNativeRegistrations(toolId);
      return (registrations?.pluginClaims ?? [])
        .filter((claim) =>
          options.pluginName.includes("@")
            ? claim.ref === options.pluginName
            : claim.ref.startsWith(`${options.pluginName}@`)
        )
        .map((claim) => ({ toolId, registrations: registrations as NativeRegistrations, claim }));
    });
    if (targets.length === 0 && nativeTargets.length === 0)
      throw new PluginNotFoundError(options.pluginName);
    if (!options.pluginName.includes("@") && nativeTargets.length > 1) {
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
        const files = await userScopeFilesSafeToDelete(
          this.fs,
          this.logger,
          plugin,
          options.tools.aiProfile(toolId),
          resolveHomeDir()
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
      const claims =
        target.registrations.pluginClaims?.filter((claim) => claim.ref !== target.claim.ref) ?? [];
      manifest.setNativeRegistrations(target.toolId, {
        ...target.registrations,
        pluginRefs: target.registrations.pluginRefs.filter((ref) => ref !== target.claim.ref),
        pluginClaims: claims,
      });
    }
    for (const { toolId, plugin, files } of safeFiles) {
      await deletePluginFilesForTool(
        files,
        "user",
        options.tools.aiProfile(toolId),
        options.projectRoot,
        this.fs,
        "user"
      );
      manifest.removePlugin(toolId, plugin.name);
    }
    await repo.save(manifest);
  }

  private async removeFromTools(
    pluginName: string,
    toolIds: AiToolId[],
    tools: ToolCatalog,
    projectRoot: string,
    manifest: Manifest
  ): Promise<boolean> {
    let removed = false;
    for (const toolId of toolIds) {
      const tool = tools.aiProfile(toolId);
      const plugins = manifest.getPlugins(toolId);
      const plugin = plugins.find((p) => p.name === pluginName);
      if (plugin === undefined) continue;
      const registrations = manifest.getNativeRegistrations(toolId);
      const baseDir = resolveBaseDirFromRecord(plugin.scope, tool, projectRoot, nodeHomedir);
      const confirmed =
        plugin.marketplace === undefined
          ? undefined
          : await this.withdrawFromHost.execute({
              tool,
              plugin: { name: plugin.name, marketplace: plugin.marketplace, scope: plugin.scope },
              projectRoot,
              registrations,
              claims: {
                isMachineOwned: (ref) =>
                  isMachineOwnedNativeRef(this.userManifestRepo, toolId, ref),
                guardMessage: (binary, ref, alias, hostName) =>
                  this.describeGuardedPluginRef(binary, tool, ref, alias, hostName, projectRoot),
                resolveCacheCandidate: (cacheRoot, relativeSegments, label) =>
                  resolveCacheCandidate(this.fs, this.logger, cacheRoot, relativeSegments, label),
              },
              pluginCacheRoot: tool.nativeActivation()?.pluginCacheRoot(resolveHomeDir()),
            });
      if (plugin.scope !== "user") await this.deletePluginFiles(plugin.files, baseDir);
      await this.removeMcpEntries(plugin, tool, projectRoot);
      await removeProjectHooks(this.fs, plugin, tool, projectRoot);
      const hostName = registrations?.marketplaces.find(
        (m) => m.alias === plugin.marketplace
      )?.hostName;
      const ref = hostName === undefined ? undefined : `${plugin.name}@${hostName}`;
      const canDetachRef =
        confirmed === true ||
        (ref !== undefined &&
          tool.pluginEnablementIsMachineGlobal() &&
          (await isMachineOwnedNativeRef(this.userManifestRepo, toolId, ref)));
      if (hostName !== undefined && registrations !== undefined && canDetachRef) {
        manifest.setNativeRegistrations(toolId, {
          ...registrations,
          pluginRefs: registrations.pluginRefs.filter(
            (ref) => ref !== `${plugin.name}@${hostName}`
          ),
        });
      }
      manifest.removePlugin(toolId, pluginName);
      removed = true;
    }
    return removed;
  }

  /**
   * A ref enabled through the shared, machine-scope source at a host that enables a plugin
   * machine-wide (no `scopeArgs` — codex, copilot) must survive a `plugin remove` in one project
   * while another project on this machine still references that source: uninstalling it here would
   * disable it there too.
   *
   * `plugin remove` never decrements `references.json` the way `clean` does, so this project's own
   * root is still in what `listAllReferencingProjects` returns and is subtracted by hand —
   * otherwise a project holding the *only* reference would read itself back as "another project".
   *
   * `ref` carries the host's own name for the marketplace, never `plugin.marketplace` alone, which
   * a host never learns; `marketplaceAlias` stays the key this project's own registry is read by.
   * Both sides must move together, or a ref moved to `hostName` while this parameter kept the
   * alias would silently stop guarding anything.
   */
  private async describeGuardedPluginRef(
    binary: string,
    tool: AiToolProfile,
    ref: string,
    marketplaceAlias: string,
    hostName: string,
    projectRoot: string
  ): Promise<string | undefined> {
    if (this.userSourceReferences === undefined) return undefined;
    const marketplaces = (await this.marketplaceRegistry?.list(projectRoot)) ?? [];
    const marketplace = marketplaces.find((m) => m.name === marketplaceAlias);
    if (
      marketplace === undefined ||
      !frameworkSourceIsShared(marketplace.name, marketplace.scope)
    ) {
      return undefined;
    }
    const userSourceReferences = this.userSourceReferences;
    const otherProjects = await toleratingUnreadableSourceReferences(
      this.logger,
      [] as readonly string[],
      async () => {
        const ownRoot = await resolveProjectRootForReferences(this.fs, projectRoot);
        return otherProjectsReferencing(userSourceReferences, ownRoot);
      }
    );
    const guarded = refAnotherProjectStillNeeds({
      ref,
      sharedSourceHostName: hostName,
      enablementIsMachineGlobal: tool.pluginEnablementIsMachineGlobal(),
      otherProjects,
    });
    if (!guarded) return undefined;
    return describeGuardedPluginRefMessage({ binary, ref, otherProjects });
  }

  private async removeMcpEntries(
    plugin: InstalledPlugin,
    tool: AiToolProfile,
    projectRoot: string
  ): Promise<void> {
    if (plugin.mcpEntries.size === 0) return;
    const mcpCap = tool.flatPluginMcp();
    if (mcpCap === null) return;
    const outputRelPath = await mcpCap.resolveOutputPath((relativePath) =>
      this.fs.fileExists(join(projectRoot, relativePath))
    );
    const outputPath = join(projectRoot, outputRelPath);
    const existing = await this.readExistingJson(outputPath);
    if (existing === null) return;
    const updated = mcpCap.removePluginServers(existing, plugin.mcpEntries);
    await assertProjectPathWithinRoot(this.fs, projectRoot, outputPath);
    await this.fs.writeFile(outputPath, updated);
  }

  private async readExistingJson(path: string): Promise<string | null> {
    try {
      return await this.fs.readFile(path);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  private async deletePluginFiles(
    files: ReadonlyMap<string, string>,
    baseDir: string
  ): Promise<void> {
    for (const relativePath of files.keys()) {
      const fullPath = join(baseDir, relativePath);
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
    }
  }
}
