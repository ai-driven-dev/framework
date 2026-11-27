import type { Lock } from "../../../../shared/ports/lock.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import {
  claimUserScopePlugins,
  pluginsHeld,
  type UserScopeOwnership,
} from "../ownership/claim-user-scope-plugins.js";
import { loadAddManifests } from "./add/load-add-manifests.js";
import type { AddPluginRequest, PluginAdd } from "./add/plugin-add.js";
import type { AddPluginToProject } from "./add-plugin-to-project.use-case.js";
import { resolvePluginToolIds } from "./plugin-target-resolution.js";

/** The two manifests an add touches: the project's, and the machine's, which guards the lock. */
export interface AddPluginManifests {
  project: ManifestRepository;
  user: ManifestRepository & Lock;
}

/** What an add collaborates with. The tool catalog is the constructor's own second argument. */
export interface AddPluginDeps {
  readonly manifests: AddPluginManifests;
  readonly addToProject: Pick<AddPluginToProject, "execute">;
  readonly ownership: UserScopeOwnership;
}

export class AddPlugin implements PluginAdd {
  constructor(
    private readonly deps: AddPluginDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: AddPluginRequest): Promise<void> {
    const { manifests } = this.deps;
    return manifests.user.withExclusiveAccess(() => this.executeLocked(options));
  }

  private async executeLocked(options: AddPluginRequest): Promise<void> {
    const { manifests, addToProject, ownership } = this.deps;
    const { toolIds, projectRoot } = options;
    const { manifest, machine } = await loadAddManifests(manifests, this.tools);
    const resolvedToolIds = resolvePluginToolIds(toolIds, manifest, this.tools);
    const heldBefore = pluginsHeld(manifest, resolvedToolIds);
    await addToProject.execute(options, { toolIds: resolvedToolIds, manifest, machine });
    const claimed = await claimUserScopePlugins(ownership, {
      project: manifest,
      machine,
      toolIds: resolvedToolIds,
      projectRoot,
      heldBefore,
    });
    if (claimed) await manifests.user.save(machine);
    await manifests.project.save(manifest);
  }
}
