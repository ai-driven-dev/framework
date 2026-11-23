import { join } from "node:path";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { Manifest } from "../../domain/manifest.js";
import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import { PLUGIN_CACHE_SUBDIR } from "../../domain/project-layout.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type {
  PlannedUserPluginFileUpdate,
  UserPluginMaterialization,
} from "../../ports/plugin/user-plugin-materialization.js";
import { requireManifest } from "../shared/require-manifest.js";
import { resolvePluginToolIds, userPluginTargets } from "./plugin-target-resolution.js";
import { assertSelectionResolves, nativeTargets, refreshNativeRefs } from "./update-native-refs.js";
import type {
  MachinePluginUpdate,
  UpdatePluginCommand,
  UpdatePluginRequest,
} from "./update-plugin-command.js";
import type { UpdateProjectPlugins } from "./update-project-plugins.use-case.js";

/** The project's manifest, and the machine's, which guards the lock. */
export interface UpdatePluginManifests {
  readonly project: ManifestRepository;
  readonly user: ManifestRepository & Lock;
}

/** What UpdatePlugin is built from. The tool catalog is the constructor's own second argument. */
export interface UpdatePluginDeps {
  readonly manifests: UpdatePluginManifests;
  readonly updateProject: Pick<UpdateProjectPlugins, "execute">;
  readonly materializer: Pick<UserPluginMaterialization, "planUpdate" | "applyUpdate">;
  readonly logger: Logger;
}

type MachineCommand = UpdatePluginRequest & MachinePluginUpdate;

/** Brings the plugins of a project, or of the machine with the native refs aidd owns, to their latest version. */
export class UpdatePlugin {
  constructor(
    private readonly deps: UpdatePluginDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute({ machine, ...command }: UpdatePluginCommand): Promise<string[]> {
    if (machine !== undefined) {
      const run = () => this.updateMachine({ ...command, ...machine });
      return this.deps.manifests.user.withExclusiveAccess(run);
    }
    if (command.scope === "user")
      throw new Error("A user-scope plugin update needs the machine's update context.");
    return this.updateProject(command);
  }

  private async updateProject(options: UpdatePluginRequest): Promise<string[]> {
    const { pluginNames, toolIds, projectRoot } = options;
    const manifest = await requireManifest(this.deps.manifests.project);
    const update = {
      projectRoot,
      cacheDir: join(projectRoot, PLUGIN_CACHE_SUBDIR),
      manifest,
      rebuild: options.rebuild === true,
    };
    const updated: string[] = [];
    for (const toolId of resolvePluginToolIds(toolIds, manifest, this.tools)) {
      const tool = this.tools.aiProfile(toolId);
      updated.push(...(await this.deps.updateProject.execute(tool, pluginNames, update)));
    }
    await this.deps.manifests.project.save(manifest);
    return updated;
  }

  private async updateMachine(options: MachineCommand): Promise<string[]> {
    const repo = this.deps.manifests.user;
    const loaded = await repo.load();
    if (loaded === null)
      throw new Error(
        "No machine manifest: cannot prove AIDD ownership for user-scope plugin update."
      );
    const manifest = Manifest.fromJSON(loaded.toJSON(), (raw) => this.tools.toolId(raw));
    const toolIds = resolvePluginToolIds(options.toolIds, manifest, this.tools);
    const targets = userPluginTargets(manifest, toolIds, options.pluginNames);
    const { refSelection } = options;
    const natives = nativeTargets(refSelection, await refSelection.loadRecords(), {
      toolIds,
      options,
    });
    assertSelectionResolves(refSelection, options, { files: targets.length, native: natives });
    const filePlans = await this.planFiles(targets, options);
    const updated = await refreshNativeRefs(this.deps.logger, this.tools, {
      targets: natives,
      options,
    });
    for (const { toolId, plugin, plan } of filePlans) {
      if (plan === null) continue;
      manifest.updatePlugin(toolId, await this.applyFilePlan({ toolId, plugin, plan }, options));
      updated.push(plugin.plugin.name);
    }
    if (updated.length > 0) await repo.save(manifest);
    return updated;
  }

  /** One plan at a time: plans for one tool share its built tree, which the first one builds. */
  private async planFiles(targets: ReturnType<typeof userPluginTargets>, options: MachineCommand) {
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
    return filePlans;
  }

  private async applyFilePlan(
    planned: { toolId: AiToolId; plugin: RecordedPlugin; plan: PlannedUserPluginFileUpdate },
    options: MachineCommand
  ): Promise<RecordedPlugin> {
    const { toolId, plugin, plan } = planned;
    const dependents = options.refSelection.holdersOf([plugin], []);
    if (dependents.length > 0)
      this.deps.logger.warn(
        `${toolId}: updating user-scope '${plugin.plugin.name}' affects ${dependents.join(", ")}; each project must refresh its own integration afterward.`
      );
    return options.afterPreflight(toolId, () =>
      this.deps.materializer.applyUpdate(plan, {
        logger: this.deps.logger,
        isWithinUserScope: options.isWithinUserScope,
      })
    );
  }
}
