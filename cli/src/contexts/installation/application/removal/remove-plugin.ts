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
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { NativeRegistrations } from "../../domain/manifest/native-registrations.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { HostWithdrawal } from "../../ports/native-host.js";
import type { PluginRemovalTool } from "../../ports/tool-sections.js";
import { assertProjectPathWithinRoot } from "../ownership/project-path-boundary.js";
import { deletePluginFilesForTool } from "../plugin/plugin-helpers.js";
import {
  resolveBaseDirFromRecord,
  resolvePluginToolIds,
} from "../plugin/plugin-target-resolution.js";
import { assertProjectHooksRemovable, removeProjectHooks } from "../shared/remove-project-hooks.js";
import { requireManifest } from "../shared/require-manifest.js";
import { assertProjectMcpEntriesRemovable, type RemovalClaims } from "./remove-project-plugin.js";

/** What a removal asks the machine scope, supplied by the composition root: who else owns a ref,
 * whether another project still needs it, which cache path is provably inside its root, which of a
 * plugin's files are provably inside the user scope, and the home directory they are read under. */
export interface PluginRemovalClaims extends RemovalClaims {
  readonly home: string;
  isMachineOwned(toolId: ToolId, ref: string): Promise<boolean>;
  guardMessage(
    binary: string,
    tool: PluginRemovalTool,
    ref: string,
    marketplaceAlias: string,
    hostName: string,
    projectRoot: string
  ): Promise<string | undefined>;
  resolveCacheCandidate(
    cacheRoot: string,
    relativeSegments: string,
    label: string
  ): Promise<string | null>;
  userFilesSafeToDelete(
    plugin: InstalledPlugin,
    tool: PluginRemovalTool
  ): Promise<ReadonlyMap<string, string>>;
}

/** The project manifest, and the machine one a user-scope removal is serialised through. */
export interface PluginRemovalManifests {
  readonly project: ManifestRepository;
  readonly user?: ManifestRepository & Lock;
}

export interface PluginRemoveOptions {
  pluginName: string;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  tools: ToolCatalog;
  scope?: "project" | "user";
}

export class RemovePlugin {
  constructor(
    private readonly fs: FileWriter & FileReader,
    private readonly manifests: PluginRemovalManifests,
    private readonly withdrawFromHost: HostWithdrawal,
    private readonly claims: PluginRemovalClaims
  ) {}

  async execute(options: PluginRemoveOptions): Promise<void> {
    if (options.scope === "user") {
      if (this.manifests.user === undefined)
        throw new Error("User manifest repository is required for user-scope plugin removal.");
      return this.manifests.user.withExclusiveAccess(() => this.removeUserPlugin(options));
    }
    const { pluginName, toolIds, projectRoot, tools } = options;
    const manifest = await requireManifest(this.manifests.project);
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
          isMachineOwned: (ref) => this.claims.isMachineOwned(toolId, ref),
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
    await this.manifests.project.save(manifest);
    await this.claims.detachNativeRefs(projectRoot, nativeRefs);
    for (const toolId of userTools) {
      await this.claims.detachUserPlugin(toolId, pluginName, projectRoot);
    }
  }

  private async removeUserPlugin(options: PluginRemoveOptions): Promise<void> {
    const repo = this.manifests.user;
    if (repo === undefined)
      throw new Error("User manifest repository is required for user-scope plugin removal.");
    const manifest = await requireManifest(repo);
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
        const files = await this.claims.userFilesSafeToDelete(
          plugin,
          options.tools.aiProfile(toolId)
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
                isMachineOwned: (ref) => this.claims.isMachineOwned(toolId, ref),
                guardMessage: (binary, ref, alias, hostName) =>
                  this.claims.guardMessage(binary, tool, ref, alias, hostName, projectRoot),
                resolveCacheCandidate: (cacheRoot, relativeSegments, label) =>
                  this.claims.resolveCacheCandidate(cacheRoot, relativeSegments, label),
              },
              pluginCacheRoot: tool.nativeActivation()?.pluginCacheRoot(this.claims.home),
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
          (await this.claims.isMachineOwned(toolId, ref)));
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

  private async removeMcpEntries(
    plugin: InstalledPlugin,
    tool: PluginRemovalTool,
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
