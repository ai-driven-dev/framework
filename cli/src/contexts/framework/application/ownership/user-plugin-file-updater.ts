import { homedir as nodeHomedir } from "node:os";
import { join } from "node:path";
import type { InstallationFile } from "../../../../kernel/file.js";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { Hasher } from "../../../../kernel/ports/hasher.js";
import type { Logger } from "../../../../kernel/ports/logger.js";
import { compareSemver } from "../../../../kernel/semver.js";
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
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
  readonly tool: AiToolProfile;
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
    tool: AiToolProfile,
    projectRoot: string,
    logger: Logger
  ): Promise<InstalledPlugin | null> {
    const plan = await this.planUpdate(plugin, tool, projectRoot, logger);
    return plan === null ? null : this.applyUpdate(plan, logger);
  }

  async planUpdate(
    plugin: InstalledPlugin,
    tool: AiToolProfile,
    projectRoot: string,
    logger: Logger,
    rebuild = false
  ): Promise<PlannedUserPluginFileUpdate | null> {
    const toolId = tool.toolId;
    const dist = await this.loader.loadLatest(plugin, projectRoot);
    if (!rebuild && compareSemver(dist.manifest.version, plugin.version) <= 0) return null;
    const { files, componentPaths } = await this.materializeFiles(dist, tool, plugin, projectRoot);
    const home = (this.builtDeps?.homedir ?? nodeHomedir)();
    const present = await withoutMissingFiles(this.fs, plugin, tool, home);
    const oldSafe = await userScopeFilesSafeToDelete(this.fs, logger, present, tool, home);
    if (oldSafe.size !== present.files.size) {
      throw new Error(
        `${toolId}: '${plugin.name}' has unsafe recorded files; update refused without dropping its machine claim.`
      );
    }
    await this.assertWritable(plugin, tool, files, home);
    const baseDir = resolveBaseDirFromRecord("user", tool, projectRoot, () => home);
    return {
      plugin,
      tool,
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
    const present = await withoutMissingFiles(this.fs, plan.plugin, plan.tool, plan.home);
    const oldSafe = await userScopeFilesSafeToDelete(
      this.fs,
      logger,
      present,
      plan.tool,
      plan.home
    );
    if (oldSafe.size !== present.files.size || oldSafe.size !== plan.oldSafe.size) {
      throw new Error(
        `${plan.tool.toolId}: '${plan.plugin.name}' has unsafe recorded files since preflight; update refused before writing.`
      );
    }
    await this.assertWritable(plan.plugin, plan.tool, plan.files, plan.home);
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
    tool: AiToolProfile,
    files: readonly InstallationFile[],
    home: string
  ): Promise<void> {
    if (tool.plugins()?.globalFiles() != null) {
      await assertGlobalFilesWritable(this.fs, tool, plugin, plugin.name, files, home);
      return;
    }
    const baseDir = resolveBaseDirFromRecord("user", tool, "", () => home);
    // A first install owns no file yet, and a restore may have lost the directory: it is created
    // so the containment proof has a real path to resolve. The name is one safe path segment.
    if (PLUGIN_NAME_REGEX.test(plugin.name)) {
      await this.fs.createDirectory(join(baseDir, plugin.name));
    }
    await assertUserScopeWriteBoundary(this.fs, tool, plugin.name, [...files], home);
    await this.assertNewFilesDoNotCollide(plugin, tool.toolId, baseDir, files);
  }

  private async assertNewFilesDoNotCollide(
    plugin: InstalledPlugin,
    toolId: AiToolProfile["toolId"],
    baseDir: string,
    files: readonly InstallationFile[]
  ): Promise<void> {
    for (const file of files) {
      if (plugin.files.has(file.relativePath)) continue;
      const target = join(baseDir, file.relativePath);
      if (!(await this.fs.fileExists(target))) continue;
      throw new Error(
        `${toolId}: '${plugin.name}' has untracked existing file '${file.relativePath}'; update refused without overwriting user content or changing its machine claim.`
      );
    }
  }

  private async materializeFiles(
    dist: PluginDistribution,
    tool: AiToolProfile,
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
        target: tool.toolId,
        mode: tool.frameworkBuildMode(),
      });
      if (tool.plugins()?.globalFiles() != null) {
        const files = await readGlobalPluginFiles(this.fs, this.hasher, builtDir, tool, dist);
        return { files, componentPaths: new Map() };
      }
      const built = await readBuiltUserPluginFiles(this.fs, this.hasher, builtDir, plugin.name);
      const files =
        tool.plugins()?.deliversHooksToProject() === true
          ? withoutHooksPrefix(built, plugin.name)
          : built;
      return { files, componentPaths: new Map() };
    }
    // Without the built tree, translation would write a project's layout in the user directory.
    if (tool.plugins()?.globalFiles() != null) {
      throw new Error(
        `${tool.toolId}: the shared framework source is not registered, so '${plugin.name}' cannot be rebuilt; run \`aidd setup --global\`.`
      );
    }
    const forGlobalFiles =
      tool.plugins()?.deliversHooksToProject() === true ? withoutHooks(dist) : dist;
    const translated = new PluginContentTranslator(this.hasher).translateWithComponentPaths(
      forGlobalFiles,
      tool
    );
    return { files: translated.files, componentPaths: translated.componentPaths };
  }
}
