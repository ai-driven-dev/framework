import { join } from "node:path";
import type { InstallationFile } from "../../../../shared/domain/file.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import { compareSemver } from "../../../../shared/domain/semver.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import { InstalledPlugin, PLUGIN_NAME_REGEX } from "../../domain/plugins/installed-plugin.js";
import {
  readBuiltUserPluginFiles,
  withoutHooksPrefix,
} from "../materialize/built-tree-materialization-translator.js";
import { withoutHooks } from "../materialize/project-hooks-materializer.js";
import type { BuiltMaterializationDeps } from "../shared/built-materialization-deps.js";
import { hashOutputFiles } from "../shared/hash-output-files.js";
import {
  assertGlobalFilesWritable,
  type ContainmentCheck,
  readGlobalPluginFiles,
} from "./global-plugin-files.js";
import type { PluginDistributionLoader } from "./plugin-distribution-loader.js";
import { deleteOldFiles, writePluginFiles } from "./plugin-helpers.js";
import { scopeBaseOf } from "./plugin-target-resolution.js";

export interface PlannedUserPluginFileUpdate {
  readonly plugin: InstalledPlugin;
  readonly tool: AiToolProfile;
  readonly home: string;
  readonly baseDir: string;
  readonly files: readonly InstallationFile[];
  readonly oldSafe: ReadonlyMap<string, string>;
  readonly next: InstalledPlugin;
}

/** The machine-scope file safety checks, supplied by the composition root so installation never reaches machine claims. */
export interface UserScopeFileGuard {
  safeToDelete(
    reach: { readonly fs: FileReader; readonly logger: Logger; readonly home: string },
    plugin: InstalledPlugin,
    tool: AiToolProfile
  ): Promise<ReadonlyMap<string, string>>;
  withoutMissing(
    reach: { readonly fs: FileReader; readonly home: string },
    plugin: InstalledPlugin,
    tool: AiToolProfile
  ): Promise<InstalledPlugin>;
  assertWriteBoundary(
    reach: { readonly fs: FileReader; readonly home: string },
    tool: AiToolProfile,
    write: { readonly pluginName: string; readonly files: readonly InstallationFile[] }
  ): Promise<void>;
}

/** The same two steps with the containment rule already bound, for a caller that is not a scenario. */
export interface BoundPluginMaterializer {
  planUpdate(request: {
    plugin: InstalledPlugin;
    tool: AiToolProfile;
    projectRoot: string;
    logger: Logger;
    rebuild?: boolean;
  }): Promise<PlannedUserPluginFileUpdate | null>;
  applyUpdate(plan: PlannedUserPluginFileUpdate, logger: Logger): Promise<InstalledPlugin>;
}

/**
 * Plans and applies the file half of a machine-scope plugin update. The containment rule a
 * write must satisfy arrives with each call, from the scenario that owns it.
 */
export class PluginMaterializer {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly loader: PluginDistributionLoader,
    private readonly guard: UserScopeFileGuard,
    private readonly builtDeps: BuiltMaterializationDeps
  ) {}

  async update(
    plugin: InstalledPlugin,
    tool: AiToolProfile,
    projectRoot: string,
    logger: Logger,
    isWithinUserScope: ContainmentCheck
  ): Promise<InstalledPlugin | null> {
    const plan = await this.planUpdate(plugin, tool, projectRoot, logger, false, isWithinUserScope);
    return plan === null ? null : this.applyUpdate(plan, logger, isWithinUserScope);
  }

  async planUpdate(
    plugin: InstalledPlugin,
    tool: AiToolProfile,
    projectRoot: string,
    logger: Logger,
    rebuild: boolean,
    isWithinUserScope: ContainmentCheck
  ): Promise<PlannedUserPluginFileUpdate | null> {
    const toolId = tool.toolId;
    const dist = await this.loader.loadLatest(plugin, projectRoot);
    if (!rebuild && compareSemver(dist.manifest.version, plugin.version) <= 0) return null;
    const { files, componentPaths } = await this.materializeFiles(dist, tool, plugin, projectRoot);
    const home = this.builtDeps.homedir();
    const present = await this.guard.withoutMissing({ fs: this.fs, home }, plugin, tool);
    const oldSafe = await this.guard.safeToDelete({ fs: this.fs, logger, home }, present, tool);
    if (oldSafe.size !== present.files.size) {
      throw new Error(
        `${toolId}: '${plugin.name}' has unsafe recorded files; update refused without dropping its machine claim.`
      );
    }
    await this.assertWritable(plugin, tool, files, home, isWithinUserScope);
    const baseDir = scopeBaseOf(tool, {
      scope: "user",
      projectRoot: projectRoot,
      homedir: () => home,
    });
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

  async applyUpdate(
    plan: PlannedUserPluginFileUpdate,
    logger: Logger,
    isWithinUserScope: ContainmentCheck
  ): Promise<InstalledPlugin> {
    const { home } = plan;
    const present = await this.guard.withoutMissing({ fs: this.fs, home }, plan.plugin, plan.tool);
    const oldSafe = await this.guard.safeToDelete(
      { fs: this.fs, logger, home },
      present,
      plan.tool
    );
    if (oldSafe.size !== present.files.size || oldSafe.size !== plan.oldSafe.size) {
      throw new Error(
        `${plan.tool.toolId}: '${plan.plugin.name}' has unsafe recorded files since preflight; update refused before writing.`
      );
    }
    await this.assertWritable(plan.plugin, plan.tool, plan.files, plan.home, isWithinUserScope);
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
    home: string,
    isWithinUserScope: ContainmentCheck
  ): Promise<void> {
    if (tool.plugins()?.globalFiles() != null) {
      await assertGlobalFilesWritable(
        this.fs,
        tool,
        plugin,
        plugin.name,
        files,
        home,
        isWithinUserScope
      );
      return;
    }
    const baseDir = scopeBaseOf(tool, { scope: "user", projectRoot: "", homedir: () => home });
    // A first install owns no file yet, and a restore may have lost the directory: it is created
    // so the containment proof has a real path to resolve. The name is one safe path segment.
    if (PLUGIN_NAME_REGEX.test(plugin.name)) {
      await this.fs.createDirectory(join(baseDir, plugin.name));
    }
    await this.guard.assertWriteBoundary({ fs: this.fs, home }, tool, {
      pluginName: plugin.name,
      files: [...files],
    });
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
        : (await this.builtDeps.marketplaceRegistry.list(projectRoot))?.find(
            (entry) => entry.name === plugin.marketplace
          );
    if (marketplace !== undefined) {
      const { builtDir } = await this.builtDeps.ensureBuilt.execute({
        projectRoot,
        marketplace,
        target: tool.toolId,
        mode: tool.frameworkBuildMode(),
      });
      if (tool.plugins()?.globalFiles() != null) {
        const files = await readGlobalPluginFiles(this.fs, builtDir, tool, dist);
        return { files, componentPaths: new Map() };
      }
      const built = await readBuiltUserPluginFiles(
        this.fs,
        builtDir,
        plugin.name,
        this.builtDeps.platform
      );
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
    const translated = this.builtDeps.translate.execute({ distribution: forGlobalFiles, tool });
    return {
      files: hashOutputFiles(translated.files),
      componentPaths: translated.componentPaths,
    };
  }
}
