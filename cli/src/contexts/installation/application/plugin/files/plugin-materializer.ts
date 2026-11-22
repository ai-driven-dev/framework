import { join } from "node:path";
import { compareSemver } from "../../../../../shared/domain/plugin/semver.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../../shared/ports/logger.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../../tools/contract/tool-profile.js";
import type { InstalledPlugin } from "../../../domain/plugins/installed-plugin.js";
import { RecordedPlugin } from "../../../domain/plugins/recorded-plugin.js";
import { PLUGIN_CACHE_SUBDIR } from "../../../domain/project-layout.js";
import type { LoadDistribution } from "../../../ports/plugin/load-plugin-distribution.js";
import type {
  PlannedUserPluginFileUpdate,
  UserPluginMaterialization,
  UserPluginUpdateRequest,
  UserScopeFileGuard,
} from "../../../ports/plugin/user-plugin-materialization.js";
import type { BuiltMaterializationDeps } from "../../shared/built-materialization-deps.js";
import { scopeBaseOf } from "../plugin-target-resolution.js";
import { assertUserPluginWritable } from "./assert-user-plugin-writable.js";
import { deleteOldFiles } from "./delete-plugin-files.js";
import { rebuildUserPluginFiles } from "./rebuild-user-plugin-files.js";
import { writePluginFiles } from "./write-plugin-files.js";

/** What PluginMaterializer is built from. */
export interface PluginMaterializerDeps {
  readonly fs: FileReader & FileWriter;
  readonly loadDistribution: LoadDistribution;
  readonly guard: UserScopeFileGuard;
  readonly builtDeps: BuiltMaterializationDeps;
  /** A global install's fetches: it writes nothing in the project. */
  readonly globalCacheDir?: () => string;
}

/**
 * Plans and applies the file half of a machine-scope plugin update. The containment rule a
 * write must satisfy arrives with each call, from the scenario that owns it.
 */
export class PluginMaterializer implements UserPluginMaterialization {
  constructor(private readonly deps: PluginMaterializerDeps) {}

  async update(request: UserPluginUpdateRequest): Promise<RecordedPlugin | null> {
    const plan = await this.planUpdate({ ...request, rebuild: false });
    return plan === null ? null : this.applyUpdate(plan, request);
  }

  async planUpdate(
    request: UserPluginUpdateRequest & { readonly rebuild: boolean }
  ): Promise<PlannedUserPluginFileUpdate | null> {
    const { plugin: recorded, tool, projectRoot, logger, rebuild, isWithinUserScope } = request;
    const { plugin, marketplace } = recorded;
    const cacheDir = this.deps.globalCacheDir?.() ?? join(projectRoot, PLUGIN_CACHE_SUBDIR);
    const dist = await this.deps.loadDistribution(plugin.source, cacheDir, { forceRefresh: true });
    if (!rebuild && compareSemver(dist.manifest.version, plugin.version) <= 0) return null;
    const { files, componentPaths } = await rebuildUserPluginFiles(this.deps, {
      dist,
      tool,
      plugin,
      marketplace,
      projectRoot,
    });
    const home = this.deps.builtDeps.homedir();
    const { present, oldSafe } = await this.recordedSafeFiles(plugin, tool, { logger, home });
    if (oldSafe.size !== present.files.size) {
      throw new Error(
        `${tool.toolId}: '${plugin.name}' has unsafe recorded files; update refused without dropping its machine claim.`
      );
    }
    await assertUserPluginWritable(this.deps, { plugin, tool, files, home, isWithinUserScope });
    const baseDir = scopeBaseOf(tool, { scope: "user", projectRoot, homedir: () => home });
    const next = RecordedPlugin.fromDistribution({
      dist,
      source: plugin.source,
      files,
      scope: "user",
      componentPaths,
      marketplace,
    }).withMachineClaim(recorded.machineClaim);
    return { plugin: recorded, tool, home, baseDir, files, oldSafe, next };
  }

  async applyUpdate(
    plan: PlannedUserPluginFileUpdate,
    request: Pick<UserPluginUpdateRequest, "logger" | "isWithinUserScope">
  ): Promise<RecordedPlugin> {
    const { tool, home, files, baseDir } = plan;
    const { plugin } = plan.plugin;
    const { present, oldSafe } = await this.recordedSafeFiles(plugin, tool, {
      logger: request.logger,
      home,
    });
    if (oldSafe.size !== present.files.size || oldSafe.size !== plan.oldSafe.size) {
      throw new Error(
        `${tool.toolId}: '${plugin.name}' has unsafe recorded files since preflight; update refused before writing.`
      );
    }
    await assertUserPluginWritable(this.deps, {
      plugin,
      tool,
      files,
      home,
      isWithinUserScope: request.isWithinUserScope,
    });
    await writePluginFiles([...files], baseDir, this.deps.fs);
    const newPaths = new Set(files.map((file) => file.relativePath));
    await deleteOldFiles(
      new Map([...plan.oldSafe].filter(([path]) => !newPaths.has(path))),
      baseDir,
      this.deps.fs
    );
    return plan.next;
  }

  /** The recorded files still on disk, and the subset a delete may touch. */
  private async recordedSafeFiles(
    plugin: InstalledPlugin,
    tool: AiToolProfile,
    context: { readonly logger: Logger; readonly home: string }
  ) {
    const { logger, home } = context;
    const present = await this.deps.guard.withoutMissing({ fs: this.deps.fs, home }, plugin, tool);
    const oldSafe = await this.deps.guard.safeToDelete(
      { fs: this.deps.fs, logger, home },
      present,
      tool
    );
    return { present, oldSafe };
  }
}
