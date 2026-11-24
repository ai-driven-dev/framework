import { join } from "node:path";
import type { PluginDistribution } from "../../../../../shared/domain/plugin/plugin-distribution.js";
import { compareSemver } from "../../../../../shared/domain/plugin/semver.js";
import type { PluginSource } from "../../../../../shared/domain/plugin/source.js";
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
import { scopeBaseOf } from "../plugin-target-resolution.js";
import { assertUserPluginWritable } from "./assert-user-plugin-writable.js";
import { deleteOldFiles } from "./delete-plugin-files.js";
import type { RebuildUserPluginFiles } from "./rebuild-user-plugin-files.js";
import { writePluginFiles } from "./write-plugin-files.js";

/** Fetches the newest distribution of a plugin source, bypassing any cached copy. */
export type FetchLatestDistribution = (
  source: PluginSource,
  projectRoot: string
) => Promise<PluginDistribution>;

/** The latest-distribution fetch; a global install passes its own cache, so it writes nothing
 * in the project. */
export function latestDistributionOf(
  load: LoadDistribution,
  globalCacheDir?: () => string
): FetchLatestDistribution {
  return (source, projectRoot) =>
    load(source, globalCacheDir?.() ?? join(projectRoot, PLUGIN_CACHE_SUBDIR), {
      forceRefresh: true,
    });
}

/** What PluginMaterializer is built from. */
export interface PluginMaterializerDeps {
  readonly fs: FileReader & FileWriter;
  readonly guard: UserScopeFileGuard;
  readonly homedir: () => string;
  readonly fetchLatest: FetchLatestDistribution;
  readonly rebuild: RebuildUserPluginFiles;
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
    const dist = await this.deps.fetchLatest(plugin.source, projectRoot);
    if (!rebuild && compareSemver(dist.manifest.version, plugin.version) <= 0) return null;
    const { files, componentPaths } = await this.deps.rebuild({
      dist,
      tool,
      plugin,
      marketplace,
      projectRoot,
    });
    const home = this.deps.homedir();
    const baseDir = scopeBaseOf(tool, { scope: "user", projectRoot, homedir: () => home });
    const { present, oldSafe } = await this.recordedSafeFiles(plugin, tool, {
      logger,
      home,
      baseDir,
    });
    if (oldSafe.size !== present.files.size) {
      throw new Error(
        `${tool.toolId}: '${plugin.name}' has unsafe recorded files; update refused without dropping its machine claim.`
      );
    }
    await assertUserPluginWritable(this.deps, { plugin, tool, files, home, isWithinUserScope });
    const next = RecordedPlugin.fromDistribution({
      dist,
      source: plugin.source,
      files,
      scope: "user",
      componentPaths,
      marketplace,
    });
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
      baseDir,
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
      { dir: baseDir, scope: plugin.scope },
      this.deps.fs
    );
    return plan.next;
  }

  /** The recorded files still on disk, and the subset a delete may touch. */
  private async recordedSafeFiles(
    plugin: InstalledPlugin,
    tool: AiToolProfile,
    context: { readonly logger: Logger; readonly home: string; readonly baseDir: string }
  ) {
    const { logger, home, baseDir } = context;
    const present = await this.withoutMissingFiles(plugin, baseDir);
    const oldSafe = await this.deps.guard.safeToDelete(
      { fs: this.deps.fs, logger, home },
      present,
      tool
    );
    return { present, oldSafe };
  }

  /** The plugin without the recorded files nothing stands at any more, which an update writes back.
   * A dangling symlink counts as gone: the atomic write replaces the link, and never follows it. */
  private async withoutMissingFiles(
    plugin: InstalledPlugin,
    baseDir: string
  ): Promise<InstalledPlugin> {
    const present = new Map<string, string>();
    for (const [relativePath, hash] of plugin.files) {
      if (await this.deps.fs.fileExists(join(baseDir, relativePath)))
        present.set(relativePath, hash);
    }
    return plugin.withFiles(present);
  }
}
