import {
  DuplicatePluginError,
  MissingPluginMetadataError,
  ToolNotInManifestError,
  VersionMismatchError,
} from "../../../../shared/domain/errors.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { PluginSource } from "../../../../shared/domain/source.js";
import type { AiToolId, ToolIdResolver } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { Manifest } from "../../domain/manifest.js";
import {
  InstalledPlugin,
  type ProjectHooksProvenance,
} from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import { assertProjectMcpEntriesRemovable } from "../removal/remove-project-plugin.js";
import { assertProjectHooksRemovable } from "../shared/remove-project-hooks.js";
import { requireManifest } from "../shared/require-manifest.js";
import type { PlacePlugin } from "./add/place-plugin.js";
import type {
  GithubAddedPluginSource,
  ResolveAddedPluginSource,
} from "./add/resolve-added-plugin-source.js";
import { resolvePluginToolIds, resolveScopeForInstall } from "./plugin-target-resolution.js";

export interface PluginAddOptions {
  source: PluginSource;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  interactive: boolean;
  marketplace?: string;
  /** Whether the marketplace is a github one, whose native tools register without a fetch. */
  readonly githubMarketplace: boolean;
  requiredVersion?: string;
  pluginMetadata?: { name: string; version?: string; strict: boolean };
  /** When true, drop any existing entry with the same name before adding (idempotent re-add for setup re-runs). */
  replace?: boolean;
}

export interface PluginAdd {
  execute(options: PluginAddOptions): Promise<void>;
}

/** The two manifests an add touches: the project's, and the machine's, which guards the lock. */
export interface AddPluginManifests {
  project: ManifestRepository;
  user: ManifestRepository & Lock;
}

export class AddPlugin implements PluginAdd {
  private readonly manifestRepo: ManifestRepository;
  private readonly userManifestRepo: ManifestRepository & Lock;

  constructor(
    private readonly fs: FileWriter & FileReader,
    manifests: AddPluginManifests,
    private readonly source: Pick<ResolveAddedPluginSource, "execute">,
    private readonly place: Pick<PlacePlugin, "execute">,
    private readonly tools: ToolCatalog
  ) {
    this.manifestRepo = manifests.project;
    this.userManifestRepo = manifests.user;
  }

  async execute(options: PluginAddOptions): Promise<void> {
    return this.userManifestRepo.withExclusiveAccess(() => this.executeLocked(options));
  }

  private async executeLocked(options: PluginAddOptions): Promise<void> {
    const { source, toolIds, projectRoot } = options;
    const resolveToolId: ToolIdResolver = (raw) => this.tools.toolId(raw);
    const manifest = Manifest.fromJSON(
      (await requireManifest(this.manifestRepo)).toJSON(),
      resolveToolId
    );
    const existingMachine = await this.userManifestRepo.load();
    const machine =
      existingMachine === null
        ? Manifest.create()
        : Manifest.fromJSON(existingMachine.toJSON(), resolveToolId);
    const resolvedToolIds = resolvePluginToolIds(toolIds, manifest, this.tools);
    const installedBefore = pluginsInstalledBefore(manifest, resolvedToolIds);
    const { githubMarketplace } = options;
    if (githubMarketplace) await this.prepareGithubAdd(options, resolvedToolIds, manifest);
    const added = await this.source.execute({
      source,
      projectRoot,
      toolIds: resolvedToolIds,
      githubMarketplace,
      catalog: options.pluginMetadata,
    });
    if (added.isGithubMarketplace) {
      await this.addGithubMarketplacePlugin(options, added, manifest, machine);
    } else {
      await this.addLocalPlugin(options, added.distribution, resolvedToolIds, manifest, machine);
    }
    const claimed = await this.recordUserScopeOwnership(
      manifest,
      machine,
      resolvedToolIds,
      projectRoot,
      installedBefore
    );
    if (claimed) await this.userManifestRepo.save(machine);
    await this.manifestRepo.save(manifest);
  }

  /** Refuses or clears an existing entry before anything is fetched. */
  private async prepareGithubAdd(
    options: PluginAddOptions,
    toolIds: AiToolId[],
    manifest: Manifest
  ): Promise<void> {
    const { pluginMetadata } = options;
    if (pluginMetadata === undefined) throw new MissingPluginMetadataError();
    if (options.replace === true) {
      await this.assertExistingContributionsUnchanged(
        pluginMetadata.name,
        toolIds,
        manifest,
        options.projectRoot
      );
      this.dropExistingPlugin(pluginMetadata.name, toolIds, manifest);
    } else this.validateNoDuplicates(pluginMetadata.name, toolIds, manifest);
  }

  private async addGithubMarketplacePlugin(
    options: PluginAddOptions,
    added: GithubAddedPluginSource,
    manifest: Manifest,
    machine: Manifest
  ): Promise<void> {
    const { flat, distribution } = added;
    if (flat.length > 0 && distribution !== undefined)
      await this.addLocalPlugin(options, distribution, flat, manifest, machine);
    await this.registerNativeGithubPlugins(options, added, manifest);
  }

  private async registerNativeGithubPlugins(
    options: PluginAddOptions,
    added: GithubAddedPluginSource,
    manifest: Manifest
  ): Promise<void> {
    const { pluginMetadata, marketplace, source } = options;
    const { native, version } = added;
    if (pluginMetadata === undefined || native.length === 0 || version === undefined) return;
    for (const toolId of native) {
      manifest.addPlugin(
        toolId,
        InstalledPlugin.fromMetadata(
          pluginMetadata.name,
          version,
          source,
          pluginMetadata.strict,
          resolveScopeForInstall(this.tools.aiProfile(toolId)),
          marketplace
        )
      );
    }
  }

  private async addLocalPlugin(
    options: PluginAddOptions,
    read: PluginDistribution,
    resolvedToolIds: AiToolId[],
    manifest: Manifest,
    machine: Manifest
  ): Promise<void> {
    const { source, projectRoot, marketplace, requiredVersion, replace, pluginMetadata } = options;
    const dist = pluginMetadata === undefined ? read : read.withStrict(pluginMetadata.strict);
    const pluginName = dist.manifest.name;
    this.assertPluginVersionMatches(pluginName, dist.manifest.version, requiredVersion);
    if (replace === true)
      await this.assertExistingContributionsUnchanged(
        pluginName,
        resolvedToolIds,
        manifest,
        projectRoot
      );
    const { prevMcpMap, prevHooksMap } = this.prepareForInstall(
      pluginName,
      resolvedToolIds,
      manifest,
      replace
    );
    await this.place.execute({
      dist,
      toolIds: resolvedToolIds,
      source,
      projectRoot,
      manifest,
      machine,
      marketplace,
      previousMcpEntries: prevMcpMap,
      previousProjectHooks: prevHooksMap,
    });
  }

  private async assertExistingContributionsUnchanged(
    pluginName: string,
    toolIds: readonly AiToolId[],
    manifest: Manifest,
    projectRoot: string
  ): Promise<void> {
    for (const toolId of toolIds) {
      const previous = manifest.getPlugins(toolId).find((plugin) => plugin.name === pluginName);
      if (previous === undefined) continue;
      const tool = this.tools.aiProfile(toolId);
      await assertProjectMcpEntriesRemovable(this.fs, { plugin: previous, tool, projectRoot });
      await assertProjectHooksRemovable(this.fs, previous, tool, projectRoot);
    }
  }

  private prepareForInstall(
    pluginName: string,
    toolIds: AiToolId[],
    manifest: Manifest,
    replace: boolean | undefined
  ): {
    prevMcpMap: Map<AiToolId, ReadonlyMap<string, string>>;
    prevHooksMap: Map<AiToolId, ProjectHooksProvenance>;
  } {
    const prevMcpMap = this.collectPreviousMcpEntries(pluginName, toolIds, manifest);
    const prevHooksMap = new Map<AiToolId, ProjectHooksProvenance>();
    for (const toolId of toolIds) {
      const projectHooks = manifest
        .getPlugins(toolId)
        .find((p) => p.name === pluginName)?.projectHooks;
      if (projectHooks !== undefined) prevHooksMap.set(toolId, projectHooks);
    }
    if (replace === true) {
      this.dropExistingPlugin(pluginName, toolIds, manifest);
    } else {
      this.validateNoDuplicates(pluginName, toolIds, manifest);
    }
    return { prevMcpMap, prevHooksMap };
  }

  private async recordUserScopeOwnership(
    project: Manifest,
    machine: Manifest,
    toolIds: readonly AiToolId[],
    projectRoot: string,
    installedBefore: PluginsInstalledBefore
  ): Promise<boolean> {
    const root = await this.fs.realpath(projectRoot);
    let claimed = false;
    for (const toolId of toolIds) {
      for (const plugin of project.getPlugins(toolId)) {
        if (plugin.scope !== "user") continue;
        const owned = machine.getPlugins(toolId).find((p) => p.name === plugin.name);
        if (owned === undefined && installedBefore.has(installedKey(toolId, plugin.name))) continue;
        if (owned === undefined && plugin.files.size === 0) continue;
        if (!machine.hasTool(toolId)) {
          const version = project.getToolVersion(toolId);
          if (version === undefined) throw new ToolNotInManifestError(toolId);
          machine.addTool(toolId, version, []);
        }
        const canonical = (
          owned ?? InstalledPlugin.withMcpEntries(plugin, new Map())
        ).withDependents([...(owned?.dependents ?? []), root]);
        machine.withPlugin(toolId, canonical);
        project.updatePlugin(toolId, plugin.withFiles(new Map()));
        claimed = true;
      }
    }
    return claimed;
  }

  private collectPreviousMcpEntries(
    pluginName: string,
    toolIds: AiToolId[],
    manifest: Manifest
  ): Map<AiToolId, ReadonlyMap<string, string>> {
    const result = new Map<AiToolId, ReadonlyMap<string, string>>();
    for (const toolId of toolIds) {
      const existing = manifest.getPlugins(toolId).find((p) => p.name === pluginName);
      if (existing !== undefined && existing.mcpEntries.size > 0) {
        result.set(toolId, existing.mcpEntries);
      }
    }
    return result;
  }

  private assertPluginVersionMatches(
    name: string,
    actual: string,
    requested: string | undefined
  ): void {
    if (!requested) return;
    if (actual !== requested) throw new VersionMismatchError(name, requested, actual);
  }

  private validateNoDuplicates(pluginName: string, toolIds: AiToolId[], manifest: Manifest): void {
    for (const toolId of toolIds) {
      const exists = manifest.getPlugins(toolId).some((p) => p.name === pluginName);
      if (exists) throw new DuplicatePluginError(pluginName);
    }
  }

  private dropExistingPlugin(pluginName: string, toolIds: AiToolId[], manifest: Manifest): void {
    for (const toolId of toolIds) {
      manifest.withoutPlugin(toolId, pluginName);
    }
  }
}

type PluginsInstalledBefore = ReadonlySet<string>;

function pluginsInstalledBefore(
  manifest: Manifest,
  toolIds: readonly AiToolId[]
): PluginsInstalledBefore {
  return new Set(
    toolIds.flatMap((toolId) =>
      manifest.getPlugins(toolId).map((p) => installedKey(toolId, p.name))
    )
  );
}

function installedKey(toolId: AiToolId, pluginName: string): string {
  return `${toolId}/${pluginName}`;
}
