import { homedir as nodeHomedir } from "node:os";
import { dirname, join, relative } from "node:path";
import type { InstallationFile } from "../../../../kernel/file.js";
import { samePath } from "../../../../kernel/paths.js";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { Hasher } from "../../../../kernel/ports/hasher.js";
import type { Logger } from "../../../../kernel/ports/logger.js";
import { compareSemver, isSemver } from "../../../../kernel/semver.js";
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
} from "../shared/user-scope-plugin-files.js";
import { assertGlobalFilesWritable, readGlobalPluginFiles } from "./global-plugin-files.js";
import type {
  PinnedUserFramework,
  PinnedUserFrameworkResult,
} from "./release/pinned-user-framework.js";
import { planKiloTuiInstall } from "./tui/kilo-tui-config.js";

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

  async withPinnedSession<T>(action: (pinned?: PinnedUserFramework) => Promise<T>): Promise<T> {
    const pinned = this.builtDeps?.pinnedFramework;
    return pinned?.withSession ? pinned.withSession(action) : action(pinned);
  }

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
    rebuild = false,
    prepared?: PinnedUserFrameworkResult,
    session?: PinnedUserFramework
  ): Promise<PlannedUserPluginFileUpdate | null> {
    const source = plugin.source;
    const cacheRoot = this.builtDeps?.userCacheRoot?.() ?? projectRoot;
    const builder = session ?? this.builtDeps?.pinnedFramework;
    const pinned =
      prepared ??
      (source.kind === "git-subdir" &&
      source.url === "https://github.com/ai-driven-dev/framework.git" &&
      source.path === `plugins/${plugin.name}` &&
      source.ref?.startsWith("v") &&
      isSemver(source.ref) &&
      frameworkBuildModeFor(toolId) === "flat" &&
      globalFilesOf(toolId) !== null &&
      builder !== undefined
        ? await builder.build(source.ref, toolId, plugin.name, source.sha)
        : undefined);
    if (prepared && (source.kind !== "git-subdir" || source.sha !== prepared.sha))
      throw new Error("Prepared release does not match the selected plugin commit.");
    const dist = pinned?.dist ?? (await this.loader.loadLatest(plugin, cacheRoot));
    if (!rebuild && compareSemver(dist.manifest.version, plugin.version) <= 0) return null;
    const { files, componentPaths } = pinned
      ? { files: [...pinned.files], componentPaths: new Map<string, string>() }
      : await this.materializeFiles(dist, toolId, plugin, cacheRoot);
    const home = (this.builtDeps?.homedir ?? nodeHomedir)();
    const tui = resolvePluginsCapability(toolId)?.startupTui;
    const isKiloMaintenance = tui?.plugin === plugin.name;
    const hasTui = files.some((file) => file.relativePath === tui?.module);
    const baseDir = resolveBaseDirFromRecord("user", toolId, projectRoot, () => home);
    if (isKiloMaintenance && plugin.tuiPlugin !== undefined && !hasTui) {
      throw new Error(
        "Kilo TUI: the new plugin no longer contains the owned TUI module; update refused."
      );
    }
    const tuiPlan =
      isKiloMaintenance && hasTui
        ? await planKiloTuiInstall(this.fs, baseDir, home, plugin.tuiPlugin)
        : undefined;
    const oldSafe = await this.inspectOwnedFiles(
      plugin,
      toolId,
      home,
      baseDir,
      files,
      logger,
      prepared === undefined
    );
    await this.assertWritable(plugin, toolId, files, home);
    return {
      plugin,
      toolId,
      home,
      baseDir,
      files,
      oldSafe,
      next: InstalledPlugin.fromDistribution(
        dist,
        pinned && source.kind === "git-subdir" ? { ...source, sha: pinned.sha } : plugin.source,
        files,
        "user",
        componentPaths,
        plugin.marketplace
      )
        .withDependents(plugin.dependents)
        .withTuiPlugin(tuiPlan?.provenance),
    };
  }

  async applyUpdate(plan: PlannedUserPluginFileUpdate, logger: Logger): Promise<InstalledPlugin> {
    const oldSafe = await this.inspectOwnedFiles(
      plan.plugin,
      plan.toolId,
      plan.home,
      plan.baseDir,
      plan.files,
      logger,
      plan.oldSafe.size < plan.plugin.files.size
    );
    if (
      oldSafe.size !== plan.oldSafe.size ||
      [...oldSafe.keys()].some((path) => !plan.oldSafe.has(path))
    ) {
      throw new Error(
        `${plan.toolId}: '${plan.plugin.name}' has unsafe recorded files since preflight; update refused before writing.`
      );
    }
    await this.assertWritable(plan.plugin, plan.toolId, plan.files, plan.home);
    const tuiPlan =
      plan.next.tuiPlugin === undefined
        ? undefined
        : await planKiloTuiInstall(this.fs, plan.baseDir, plan.home, plan.plugin.tuiPlugin);
    if (tuiPlan !== undefined && tuiPlan.provenance.config !== plan.next.tuiPlugin?.config) {
      throw new Error("Kilo TUI: configuration changed since planning; update refused.");
    }
    await writePluginFiles([...plan.files], plan.baseDir, this.fs);
    const newPaths = new Set(plan.files.map((file) => file.relativePath));
    await deleteOldFiles(
      new Map([...plan.oldSafe].filter(([path]) => !newPaths.has(path))),
      plan.baseDir,
      this.fs
    );
    if (tuiPlan !== undefined) {
      const current = await planKiloTuiInstall(
        this.fs,
        plan.baseDir,
        plan.home,
        plan.plugin.tuiPlugin
      );
      if (current.provenance.config !== plan.next.tuiPlugin?.config) {
        throw new Error("Kilo TUI: configuration changed since planning; update incomplete.");
      }
      await this.fs.writeFile(current.path, current.content);
    }
    return plan.next;
  }

  private async inspectOwnedFiles(
    plugin: InstalledPlugin,
    toolId: AiToolId,
    home: string,
    baseDir: string,
    files: readonly InstallationFile[],
    logger: Logger,
    restoreMissing: boolean
  ): Promise<ReadonlyMap<string, string>> {
    const missing = new Set<string>();
    if (restoreMissing && plugin.files.size > 0) {
      const targetPaths = new Set(files.map((file) => file.relativePath));
      for (const [path, hash] of plugin.files) {
        if (!targetPaths.has(path) || !/^[0-9a-f]{32}$/.test(hash)) continue;
        const target = join(baseDir, path);
        if (await this.fs.fileExists(target)) continue;
        if (!this.fs.entryExists) throw new Error("Cannot safely inspect missing machine files.");
        if (!(await this.fs.entryExists(target))) missing.add(path);
      }
    }
    const present = plugin.withFiles(
      new Map([...plugin.files].filter(([path]) => !missing.has(path)))
    );
    const oldSafe = await userScopeFilesSafeToDelete(this.fs, logger, present, toolId, home);
    if (oldSafe.size + missing.size !== plugin.files.size) {
      throw new Error(
        `${toolId}: '${plugin.name}' has unsafe recorded files; update refused without dropping its machine claim.`
      );
    }
    if (oldSafe.size > 0) {
      const root = await this.fs.realpath(baseDir);
      for (const path of oldSafe.keys()) {
        if (!samePath(await this.fs.realpath(join(baseDir, path)), join(root, path))) {
          throw new Error(
            `${toolId}: '${plugin.name}' file '${path}' resolves through a symlink; update refused.`
          );
        }
      }
    }
    return oldSafe;
  }

  /** A tool's machine files spread across its user directory; a user-scope plugin directory
   * holds one plugin per subdirectory. Each layout has its own containment proof. */
  private async assertWritable(
    plugin: InstalledPlugin,
    toolId: AiToolId,
    files: readonly InstallationFile[],
    home: string
  ): Promise<void> {
    const globalFiles = globalFilesOf(toolId);
    if (globalFiles !== null) {
      await assertGlobalFilesWritable(this.fs, toolId, plugin, plugin.name, files, home);
      await this.assertDirectPaths(toolId, plugin.name, files, globalFiles.dir(home));
      return;
    }
    const baseDir = resolveBaseDirFromRecord("user", toolId, "", () => home);
    // A first machine-wide install owns no file yet: its directory is created so the
    // containment proof has a real path to resolve. The name is one safe path segment.
    if (PLUGIN_NAME_REGEX.test(plugin.name)) {
      await this.fs.createDirectory(join(baseDir, plugin.name));
    }
    await assertUserScopeWriteBoundary(this.fs, toolId, plugin.name, [...files], home);
    await this.assertDirectPaths(toolId, plugin.name, files, baseDir);
    await this.assertNewFilesDoNotCollide(plugin, toolId, baseDir, files);
  }

  /** Existing destinations and parents must not redirect writes through user symlinks. */
  private async assertDirectPaths(
    toolId: AiToolId,
    pluginName: string,
    files: readonly InstallationFile[],
    base: string
  ): Promise<void> {
    const root = await this.fs.realpath(base);
    for (const file of files) {
      let candidate = join(base, file.relativePath);
      while (candidate !== base && !(await this.fs.fileExists(candidate))) {
        if (!this.fs.entryExists) throw new Error("Cannot safely inspect machine file paths.");
        if (await this.fs.entryExists(candidate))
          throw new Error(
            `${toolId}: '${pluginName}' path '${file.relativePath}' contains an unresolved symlink; update refused.`
          );
        candidate = dirname(candidate);
      }
      if (!samePath(await this.fs.realpath(candidate), join(root, relative(base, candidate))))
        throw new Error(
          `${toolId}: '${pluginName}' path '${file.relativePath}' resolves through a symlink; update refused.`
        );
    }
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
      throw new Error(
        `${toolId}: '${plugin.name}' has untracked existing file '${file.relativePath}'; update refused without overwriting user content or changing its machine claim.`
      );
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
    if (globalFilesOf(toolId) !== null) {
      throw new Error(
        `${toolId}: the shared framework source is not registered, so '${plugin.name}' cannot be rebuilt; run ` +
          "`aidd setup --global`."
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
