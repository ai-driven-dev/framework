import { homedir as nodeHomedir } from "node:os";
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
  resolvePluginsCapability,
} from "../../../tools/domain/registry.js";
import { PluginContentTranslator } from "../../../translate/domain/content-translator.js";
import type { PluginDistribution } from "../../../translate/domain/plugin-distribution.js";
import { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import {
  readBuiltUserPluginFiles,
  withoutHooksPrefix,
} from "../framework/translator/built-tree-materialization-translator.js";
import { withoutHooks } from "../framework/translator/project-hooks-materializer.js";
import { deleteOldFiles, writePluginFiles } from "../plugin/plugin-helpers.js";
import { resolveBaseDirFromRecord } from "../plugin/plugin-target-resolution.js";
import type { BuiltMaterializationDeps } from "../shared/apply-plugin-files-use-case.js";
import {
  assertUserScopeWriteBoundary,
  userScopeFilesSafeToDelete,
} from "../shared/user-scope-plugin-files.js";
import type { UserPluginDistributionLoader } from "./user-plugin-distribution-loader.js";

export class UserPluginFileUpdater {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly loader: UserPluginDistributionLoader,
    private readonly hasher: Hasher,
    private readonly builtDeps?: BuiltMaterializationDeps
  ) {}

  async update(
    plugin: InstalledPlugin,
    toolId: AiToolId,
    projectRoot: string,
    logger: Logger
  ): Promise<InstalledPlugin | null> {
    const dist = await this.loader.loadLatest(plugin, projectRoot);
    if (compareSemver(dist.manifest.version, plugin.version) <= 0) return null;
    const { files, componentPaths } = await this.materializeFiles(
      dist,
      toolId,
      plugin,
      projectRoot
    );
    const home = (this.builtDeps?.homedir ?? nodeHomedir)();
    const oldSafe = await userScopeFilesSafeToDelete(this.fs, logger, plugin, toolId, home);
    if (oldSafe.size !== plugin.files.size) {
      throw new Error(
        `${toolId}: '${plugin.name}' has unsafe recorded files; update refused without dropping its machine claim.`
      );
    }
    await assertUserScopeWriteBoundary(this.fs, toolId, plugin.name, files, home);
    const baseDir = resolveBaseDirFromRecord("user", toolId, projectRoot, () => home);
    await writePluginFiles(files, baseDir, this.fs);
    const newPaths = new Set(files.map((file) => file.relativePath));
    await deleteOldFiles(
      new Map([...oldSafe].filter(([path]) => !newPaths.has(path))),
      baseDir,
      this.fs
    );
    return InstalledPlugin.fromDistribution(
      dist,
      plugin.source,
      files,
      "user",
      componentPaths,
      plugin.marketplace
    ).withDependents(plugin.dependents);
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
      const built = await readBuiltUserPluginFiles(this.fs, this.hasher, builtDir, plugin.name);
      const files =
        resolvePluginsCapability(toolId)?.hooksDestination === "project"
          ? withoutHooksPrefix(built, plugin.name)
          : built;
      return { files, componentPaths: new Map() };
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
