import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { MissingPluginMetadataError } from "../../domain/installation.error.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import { assertRequestedVersion } from "./add/existing-plugin.js";
import { loadAddManifests } from "./add/load-add-manifests.js";
import type { PlacePlugin } from "./add/place-plugin.js";
import type { PluginAdd, PluginAddOptions } from "./add/plugin-add.js";
import { registerNativeGithubPlugins } from "./add/register-native-github-plugins.js";
import type {
  GithubAddedPluginSource,
  ResolveAddedPluginSource,
} from "./add/resolve-added-plugin-source.js";
import { supersedeExisting } from "./add/supersede-existing.js";
import { pluginsInstalledBefore, recordUserScopeOwnership } from "./add/user-scope-claims.js";
import { resolvePluginToolIds } from "./plugin-target-resolution.js";

/** The two manifests an add touches: the project's, and the machine's, which guards the lock. */
export interface AddPluginManifests {
  project: ManifestRepository;
  user: ManifestRepository & Lock;
}

/** The tools one add targets, with the project and machine manifests it edits. */
interface AddTargets {
  toolIds: AiToolId[];
  manifest: Manifest;
  machine: Manifest;
}

/** What an add collaborates with. The tool catalog is the constructor's own second argument. */
export interface AddPluginDeps {
  readonly fs: FileWriter & FileReader;
  readonly manifests: AddPluginManifests;
  readonly source: Pick<ResolveAddedPluginSource, "execute">;
  readonly place: Pick<PlacePlugin, "execute">;
}

export class AddPlugin implements PluginAdd {
  constructor(
    private readonly deps: AddPluginDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: PluginAddOptions): Promise<void> {
    const { manifests } = this.deps;
    return manifests.user.withExclusiveAccess(() => this.executeLocked(options));
  }

  private async executeLocked(options: PluginAddOptions): Promise<void> {
    const { manifests, source } = this.deps;
    const { toolIds, projectRoot, githubMarketplace } = options;
    const { manifest, machine } = await loadAddManifests(manifests, this.tools);
    const resolvedToolIds = resolvePluginToolIds(toolIds, manifest, this.tools);
    const installedBefore = pluginsInstalledBefore(manifest, resolvedToolIds);
    if (githubMarketplace) await this.prepareGithubAdd(options, resolvedToolIds, manifest);
    const added = await source.execute({
      source: options.source,
      projectRoot,
      toolIds: resolvedToolIds,
      githubMarketplace,
      catalog: options.pluginMetadata,
    });
    if (added.isGithubMarketplace) {
      await this.addGithubMarketplacePlugin(options, added, { manifest, machine });
    } else {
      await this.addLocalPlugin(options, added.distribution, {
        toolIds: resolvedToolIds,
        manifest,
        machine,
      });
    }
    const claimed = await recordUserScopeOwnership(this.deps.fs, {
      project: manifest,
      machine,
      toolIds: resolvedToolIds,
      projectRoot,
      installedBefore,
    });
    if (claimed) await manifests.user.save(machine);
    await manifests.project.save(manifest);
  }

  /** Refuses or clears an existing entry before anything is fetched. */
  private async prepareGithubAdd(
    options: PluginAddOptions,
    toolIds: AiToolId[],
    manifest: Manifest
  ): Promise<void> {
    const { pluginMetadata, projectRoot, replace } = options;
    if (pluginMetadata === undefined) throw new MissingPluginMetadataError();
    const existing = { pluginName: pluginMetadata.name, toolIds, manifest, projectRoot, replace };
    await supersedeExisting(this.deps.fs, this.tools, existing);
  }

  private async addGithubMarketplacePlugin(
    options: PluginAddOptions,
    added: GithubAddedPluginSource,
    manifests: Pick<AddTargets, "manifest" | "machine">
  ): Promise<void> {
    const { flat, distribution } = added;
    if (flat.length > 0 && distribution !== undefined)
      await this.addLocalPlugin(options, distribution, { toolIds: flat, ...manifests });
    registerNativeGithubPlugins(this.tools, { options, added, manifest: manifests.manifest });
  }

  private async addLocalPlugin(
    options: PluginAddOptions,
    read: PluginDistribution,
    targets: AddTargets
  ): Promise<void> {
    const { toolIds, manifest, machine } = targets;
    const { source, projectRoot, marketplace, requiredVersion, replace, pluginMetadata } = options;
    const dist = pluginMetadata === undefined ? read : read.withStrict(pluginMetadata.strict);
    const pluginName = dist.manifest.name;
    assertRequestedVersion(dist, requiredVersion);
    const existing = { pluginName, toolIds, manifest, projectRoot, replace };
    const previous = await supersedeExisting(this.deps.fs, this.tools, existing);
    await this.deps.place.execute({
      dist,
      toolIds,
      source,
      projectRoot,
      manifest,
      machine,
      marketplace,
      previousMcpEntries: previous.mcpEntries,
      previousProjectHooks: previous.projectHooks,
    });
  }
}
