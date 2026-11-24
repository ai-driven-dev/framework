import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { MissingPluginMetadataError } from "../../contract/installation.error.js";
import type { Manifest } from "../../domain/manifest.js";
import type { AssertProjectIntegrationRemovable } from "../removal/assert-project-integration-removable.use-case.js";
import { assertRequestedVersion } from "./add/existing-plugin.js";
import type { PlacePlugin } from "./add/place-plugin.use-case.js";
import type { AddPluginRequest } from "./add/plugin-add.js";
import { registerNativeGithubPlugins } from "./add/register-native-github-plugins.js";
import type {
  GithubAddedPluginSource,
  ResolveAddedPluginSource,
} from "./add/resolve-added-plugin-source.use-case.js";
import { supersedeExisting } from "./add/supersede-existing.js";

/** The tools one add targets, with the project and machine manifests it edits. */
export interface AddTargets {
  toolIds: AiToolId[];
  manifest: Manifest;
  machine: Manifest;
}

/** What placing an added plugin collaborates with. The tool catalog is the constructor's second argument. */
export interface AddPluginToProjectDeps {
  readonly assertIntegration: Pick<AssertProjectIntegrationRemovable, "execute">;
  readonly source: Pick<ResolveAddedPluginSource, "execute">;
  readonly place: Pick<PlacePlugin, "execute">;
}

/** Resolves the plugin an add names and places it for the targeted tools, replacing what it supersedes. */
export class AddPluginToProject {
  constructor(
    private readonly deps: AddPluginToProjectDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: AddPluginRequest, targets: AddTargets): Promise<void> {
    const { source, projectRoot, githubMarketplace } = options;
    const { toolIds, manifest, machine } = targets;
    if (githubMarketplace) await this.prepareGithubAdd(options, toolIds, manifest);
    const added = await this.deps.source.execute({
      source,
      projectRoot,
      toolIds,
      githubMarketplace,
      catalog: options.pluginMetadata,
    });
    if (added.isGithubMarketplace) {
      await this.addGithubMarketplacePlugin(options, added, { manifest, machine });
    } else {
      await this.addLocalPlugin(options, added.distribution, targets);
    }
  }

  /** Refuses or clears an existing entry before anything is fetched. */
  private async prepareGithubAdd(
    options: AddPluginRequest,
    toolIds: AiToolId[],
    manifest: Manifest
  ): Promise<void> {
    const { pluginMetadata, projectRoot, replace } = options;
    if (pluginMetadata === undefined) throw new MissingPluginMetadataError();
    const existing = { pluginName: pluginMetadata.name, toolIds, manifest, projectRoot, replace };
    await supersedeExisting(this.deps.assertIntegration, this.tools, existing);
  }

  private async addGithubMarketplacePlugin(
    options: AddPluginRequest,
    added: GithubAddedPluginSource,
    manifests: Pick<AddTargets, "manifest" | "machine">
  ): Promise<void> {
    const { flat, distribution } = added;
    if (flat.length > 0 && distribution !== undefined)
      await this.addLocalPlugin(options, distribution, { toolIds: flat, ...manifests });
    registerNativeGithubPlugins(this.tools, { options, added, manifest: manifests.manifest });
  }

  private async addLocalPlugin(
    options: AddPluginRequest,
    read: PluginDistribution,
    targets: AddTargets
  ): Promise<void> {
    const { toolIds, manifest, machine } = targets;
    const { source, projectRoot, marketplace, requiredVersion, replace, pluginMetadata } = options;
    const dist = pluginMetadata === undefined ? read : read.withStrict(pluginMetadata.strict);
    const pluginName = dist.manifest.name;
    assertRequestedVersion(dist, requiredVersion);
    const existing = { pluginName, toolIds, manifest, projectRoot, replace };
    const previous = await supersedeExisting(this.deps.assertIntegration, this.tools, existing);
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
      previousFiles: previous.files,
    });
  }
}
