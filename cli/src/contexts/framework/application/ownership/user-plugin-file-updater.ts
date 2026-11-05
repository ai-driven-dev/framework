import { homedir as nodeHomedir } from "node:os";
import { join } from "node:path";
import type { InstallationFile } from "../../../../kernel/file.js";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { Hasher } from "../../../../kernel/ports/hasher.js";
import type { Logger } from "../../../../kernel/ports/logger.js";
import { compareSemver } from "../../../../kernel/semver.js";
import type { AiToolId } from "../../../../kernel/tool.js";
import {
  frameworkBuildModeFor,
  getToolConfig,
  globalFilesOf,
  resolvePluginsCapability,
} from "../../../tools/domain/registry.js";
import { PluginContentTranslator } from "../../../translate/domain/content-translator.js";
import type { PluginDistribution } from "../../../translate/domain/plugin-distribution.js";
import { InstalledPlugin, PLUGIN_NAME_REGEX } from "../../domain/plugins/installed-plugin.js";
import {
  readBuiltUserPluginFiles,
  withoutHooksPrefix,
} from "../framework/translator/built-tree-materialization-translator.js";
import { withoutHooks } from "../framework/translator/project-hooks-materializer.js";
import type { PluginDistributionLoader } from "../plugin/plugin-distribution-loader.js";
import { deleteOldFiles, writePluginFiles } from "../plugin/plugin-helpers.js";
import { resolveBaseDirFromRecord } from "../plugin/plugin-target-resolution.js";
import type { BuiltMaterializationDeps } from "../shared/apply-plugin-files-use-case.js";
import {
  assertUserScopeWriteBoundary,
  userScopeFilesSafeToDelete,
  withoutMissingFiles,
} from "../shared/user-scope-plugin-files.js";
import { assertGlobalFilesWritable, readGlobalPluginFiles } from "./global-plugin-files.js";

export interface PlannedUserPluginFileUpdate {
  readonly plugin: InstalledPlugin;
  readonly toolId: AiToolId;
  readonly home: string;
  readonly baseDir: string;
  readonly files: readonly InstallationFile[];
  readonly oldSafe: ReadonlyMap<string, string>;
  readonly next: InstalledPlugin;
}

export class UserPluginFileUpdater {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly loader: PluginDistributionLoader,
    private readonly hasher: Hasher,
    private readonly builtDeps?: BuiltMaterializationDeps
  ) {}

  async update(
    plugin: InstalledPlugin,
    toolId: AiToolId,
    projectRoot: string,
    logger: Logger
  ): Promise<InstalledPlugin | null> {
    const plan = await this.planUpdate(plugin, toolId, projectRoot, logger);
    return plan === null ? null : this.applyUpdate(plan, logger);
  }

  async planUpdate(
    plugin: InstalledPlugin,
    toolId: AiToolId,
    projectRoot: string,
    logger: Logger,
    rebuild = false
  ): Promise<PlannedUserPluginFileUpdate | null> {
    const dist = await this.loader.loadLatest(plugin, projectRoot);
    if (!rebuild && compareSemver(dist.manifest.version, plugin.version) <= 0) return null;
    const { files, componentPaths } = await this.materializeFiles(
      dist,
      toolId,
      plugin,
      projectRoot
    );
    const home = (this.builtDeps?.homedir ?? nodeHomedir)();
    const present = await withoutMissingFiles(this.fs, plugin, toolId, home);
    const oldSafe = await userScopeFilesSafeToDelete(this.fs, logger, present, toolId, home);
    if (oldSafe.size !== present.files.size) {
      throw new Error(
        `${toolId}: '${plugin.name}' has unsafe recorded files; update refused without dropping its machine claim.`
      );
    }
    await this.assertWritable(plugin, toolId, files, home);
    const baseDir = resolveBaseDirFromRecord("user", toolId, projectRoot, () => home);
    return {
      plugin,
      toolId,
      home,
      baseDir,
      files,
      oldSafe,
      next: InstalledPlugin.fromDistribution(
        dist,
        plugin.source,
        files,
        "user",
        componentPaths,
        plugin.marketplace
      ).withDependents(plugin.dependents),
    };
  }

  async applyUpdate(plan: PlannedUserPluginFileUpdate, logger: Logger): Promise<InstalledPlugin> {
    const present = await withoutMissingFiles(this.fs, plan.plugin, plan.toolId, plan.home);
    const oldSafe = await userScopeFilesSafeToDelete(
      this.fs,
      logger,
      present,
      plan.toolId,
      plan.home
    );
    if (oldSafe.size !== present.files.size || oldSafe.size !== plan.oldSafe.size) {
      throw new Error(
        `${plan.toolId}: '${plan.plugin.name}' has unsafe recorded files since preflight; update refused before writing.`
      );
    }
    await this.assertWritable(plan.plugin, plan.toolId, plan.files, plan.home);
    await writePluginFiles([...plan.files], plan.baseDir, this.fs);
    const newPaths = new Set(plan.files.map((file) => file.relativePath));
    await deleteOldFiles(
      new Map([...plan.oldSafe].filter(([path]) => !newPaths.has(path))),
      plan.baseDir,
      this.fs
    );
    return plan.next;
  }

  /** A tool's global files spread across its user directory; a user-scope plugin directory
   * holds one plugin per subdirectory. Each layout has its own containment proof. */
  private async assertWritable(
    plugin: InstalledPlugin,
    toolId: AiToolId,
    files: readonly InstallationFile[],
    home: string
  ): Promise<void> {
    if (globalFilesOf(toolId) !== null) {
      await assertGlobalFilesWritable(this.fs, toolId, plugin, plugin.name, files, home);
      return;
    }
    const baseDir = resolveBaseDirFromRecord("user", toolId, "", () => home);
    // A first install owns no file yet, and a restore may have lost the directory: it is created
    // so the containment proof has a real path to resolve. The name is one safe path segment.
    if (PLUGIN_NAME_REGEX.test(plugin.name)) {
      await this.fs.createDirectory(join(baseDir, plugin.name));
    }
    await assertUserScopeWriteBoundary(this.fs, toolId, plugin.name, [...files], home);
    await this.assertNewFilesDoNotCollide(plugin, toolId, baseDir, files);
  }

  private async assertNewFilesDoNotCollide(
    plugin: InstalledPlugin,
    toolId: AiToolId,
    baseDir: string,
    files: readonly InstallationFile[]
  ): Promise<void> {
    for (const file of files) {
      if (plugin.files.has(file.relativePath)) continue;
      const target = join(baseDir, file.relativePath);
      if (!(await this.fs.fileExists(target))) continue;
      if ((await this.fs.readFileHash(target)).value !== file.hash.value) {
        throw new Error(
          `${toolId}: '${plugin.name}' has untracked existing file '${file.relativePath}'; update refused without overwriting user content or changing its machine claim.`
        );
      }
    }
  }

  private async materializeFiles(
    dist: PluginDistribution,
    toolId: AiToolId,
    plugin: InstalledPlugin,
    projectRoot: string
  ): Promise<{ files: InstallationFile[]; componentPaths: ReadonlyMap<string, string> }> {
    const marketplace =
      plugin.marketplace === undefined
        ? undefined
        : (await this.builtDeps?.marketplaceRegistry.list(projectRoot))?.find(
            (entry) => entry.name === plugin.marketplace
          );
    if (marketplace !== undefined && this.builtDeps !== undefined) {
      const { builtDir } = await this.builtDeps.ensureBuilt.execute({
        projectRoot,
        marketplace,
        target: toolId,
        mode: frameworkBuildModeFor(toolId),
      });
      if (globalFilesOf(toolId) !== null) {
        const files = await readGlobalPluginFiles(this.fs, this.hasher, builtDir, toolId, dist);
        return { files, componentPaths: new Map() };
      }
      const built = await readBuiltUserPluginFiles(this.fs, this.hasher, builtDir, plugin.name);
      const files =
        resolvePluginsCapability(toolId)?.hooksDestination === "project"
          ? withoutHooksPrefix(built, plugin.name)
          : built;
      return { files, componentPaths: new Map() };
    }
    // Without the built tree, translation would write a project's layout in the user directory.
    if (globalFilesOf(toolId) !== null) {
      throw new Error(
        `${toolId}: the shared framework source is not registered, so '${plugin.name}' cannot be rebuilt; run \`aidd setup --global\`.`
      );
    }
    const toolConfig = getToolConfig(toolId);
    const forGlobalFiles =
      resolvePluginsCapability(toolId)?.hooksDestination === "project" ? withoutHooks(dist) : dist;
    const translated = new PluginContentTranslator(this.hasher).translateWithComponentPaths(
      forGlobalFiles,
      toolConfig
    );
    return { files: translated.files, componentPaths: translated.componentPaths };
  }
}
