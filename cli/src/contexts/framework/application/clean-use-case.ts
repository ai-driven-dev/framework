import { dirname, join } from "node:path";
import {
  isMergeContentEmpty,
  type MergeFileEntry,
  removeEntriesFromJson,
} from "../../../shared/domain/merge.js";
import {
  AIDD_CONFIG_FILENAME,
  AIDD_DIR,
  AIDD_MARKETPLACES_FILENAME,
  PLUGIN_CACHE_SUBDIR,
} from "../../../shared/domain/paths.js";
import type { MarketplaceScope } from "../../../shared/domain/scope.js";
import type { ToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { Lock } from "../../../shared/ports/lock.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type { Prompter } from "../../../shared/ports/prompter.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../distribution/contract/marketplace.js";
import type { MarketplaceRegistry } from "../../distribution/ports/marketplace-registry.js";
import type {
  ProjectCleanFacts,
  ProjectRegistrationWithdrawal,
  WithdrawFromHost,
} from "../../host-registration/application/withdraw-from-host.js";
import { deletePluginFilesForTool } from "../../installation/application/plugin/plugin-helpers.js";
import {
  assertProjectHooksRemovable,
  type ProjectHooksGuard,
  removeProjectHooks,
} from "../../installation/application/shared/remove-project-hooks.js";
import type { UpdateGitignore } from "../../installation/application/update-gitignore.js";
import type { Manifest } from "../../installation/domain/manifest.js";
import { aiddGitignoreEntries } from "../../installation/domain/manifest-gitignore-entries.js";
import type { InstalledPlugin } from "../../installation/domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../installation/ports/manifest-repository.js";
import { detachNativePluginRefs } from "../../machine-claims/application/native-plugin-ownership.js";
import {
  frameworkSourceIsShared,
  otherProjectsReferencing,
  resolveProjectRootForReferences,
  toleratingUnreadableSourceReferences,
} from "../../machine-claims/application/shared-source-reference-support.js";
import { detachUserPlugin } from "../../machine-claims/application/user-plugin-ownership.js";
import { userScopeFilesSafeToDelete } from "../../machine-claims/application/user-scope-plugin-files.js";
import type { UserSourceReferences } from "../../machine-claims/ports/user-source-references.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { AiToolProfile } from "../../tools/contract/tool-profile.js";
import { resolveHomeDir } from "../domain/reading/home-dir.js";
import { assertProjectMcpEntriesRemovable } from "./ownership/project-plugin-cleanup.js";
import { resolveCacheCandidate } from "./shared/purge-declared-cache.js";

interface CleanOptions {
  projectRoot: string;
  force: boolean;
  interactive?: boolean;
  tools: ToolCatalog;
}

interface CleanPreview {
  tools: Array<{ toolId: ToolId; fileCount: number }>;
  totalFileCount: number;
  /** What a `--force` run will ask each tool's own CLI to undo — that step drives an external
   * binary, the one part of `clean` this preview cannot reduce to a file count. */
  nativeRegistrations: Array<{
    toolId: ToolId;
    binary: string;
    marketplaceCount: number;
    pluginRefCount: number;
    /** Absolute cache paths a `--force` run will attempt to purge — empty for a tool whose
     * profile declares no `NativeActivation.pluginCacheDir`. An announcement, not a guarantee:
     * whether a path is still there, and safe to purge, is known only once the host's CLI ran. */
    cachePaths: readonly string[];
  }>;
  /** The *other* projects on this machine that reference the shared source, read before
   * `--force` would drop this project's own claim, never after. `undefined` when the port was
   * never wired in, or no shared, machine-scope marketplace is registered locally. */
  sharedSourceOtherProjects?: readonly string[];
}

interface CleanResult {
  dryRun: boolean;
  manifestFound: boolean;
  preview: CleanPreview;
  fileCount: number;
}

function machineLocalFilesOf(tools: ToolCatalog, toolId: ToolId): readonly string[] {
  return tools.profile(toolId).machineLocalFiles();
}

export class CleanUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly manifestRepo: ManifestRepository,
    private readonly logger: Logger,
    private readonly updateGitignore: UpdateGitignore,
    private readonly withdrawFromHost: WithdrawFromHost,
    /** Resolves a registered marketplace's own scope, needed to undo a native registration at
     * the same scope it was added at. */
    private readonly marketplaceRegistry?: MarketplaceRegistry,
    private readonly prompter?: Prompter,
    /** The one resolver for the OS home directory this use case ever calls. */
    private readonly homeDir: () => string = resolveHomeDir,
    /** The registry of projects referencing the shared machine-scope source. Absent skips the
     * decrement entirely. */
    private readonly userSourceReferences?: UserSourceReferences,
    private readonly userManifestRepo?: ManifestRepository & Lock
  ) {}

  async execute(options: CleanOptions): Promise<CleanResult> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) {
      const emptyPreview: CleanPreview = { tools: [], totalFileCount: 0, nativeRegistrations: [] };
      return { dryRun: false, manifestFound: false, preview: emptyPreview, fileCount: 0 };
    }
    const home = this.homeDir();
    const preview = await this.buildPreview(manifest, home, options.projectRoot, options.tools);
    const dryRunResult = await this.confirmOrDryRun(options, preview);
    if (dryRunResult !== null) return dryRunResult;
    const withdrawals = this.projectWithdrawals(manifest, home, options.tools);
    const facts = this.cleanFacts(
      options.projectRoot,
      await this.marketplaceScopes(options.projectRoot)
    );
    await this.withdrawFromHost.assertProjectRegistrationsOwned(withdrawals, facts);
    for (const toolId of manifest.getInstalledToolIds()) {
      if (!options.tools.isAiTool(toolId)) continue;
      for (const plugin of manifest.getPlugins(toolId)) {
        const tool = options.tools.aiProfile(toolId);
        if (tool.projectHooksDelivery() !== null) {
          await assertProjectHooksRemovable(this.fs, plugin, tool, options.projectRoot, {
            overwriteEdited: options.force,
          });
        }
        await assertProjectMcpEntriesRemovable(this.fs, plugin, tool, options.projectRoot);
      }
    }
    // Read the other projects before host cleanup, but keep this project's claim until every
    // local cleanup step succeeds. A failed file or gitignore cleanup must not free the source.
    const sharedSourceOutcome = await this.withSharedSourceClaims(
      options.projectRoot,
      async (references, alias, resolvedRoot) => ({
        alias,
        resolvedRoot,
        otherProjects: await otherProjectsReferencing(references, resolvedRoot),
      })
    );
    // Undoing a host's own registration must happen before any of the rest: the tool's CLI
    // resolves the marketplace name against the built tree under `.aidd/cache/`, which
    // `removeAiddState` deletes next, and a host may refuse to unregister a source that is gone.
    await this.withdrawFromHost.withdrawProjectRegistrations(withdrawals, {
      ...facts,
      sharedSource: sharedSourceOutcome,
    });
    let deleted = await this.deleteAllToolFiles(manifest, options.tools, options.projectRoot);
    deleted += await this.deleteMachineLocalFiles(manifest, options.projectRoot, options.tools, {
      overwriteEdited: options.force,
    });
    await this.removeAiddState(options.projectRoot);
    // Exactly what the pipeline added on install, never a subset of it.
    await this.updateGitignore.remove(
      options.projectRoot,
      aiddGitignoreEntries(manifest, (toolId) => machineLocalFilesOf(options.tools, toolId))
    );
    // One project-level decrement, only after the local projection has been cleaned successfully.
    await this.dropSharedSourceReference(sharedSourceOutcome?.resolvedRoot);
    const nativeRefs = new Map<ToolId, readonly string[]>();
    for (const toolId of manifest.getInstalledToolIds()) {
      const refs = manifest.getNativeRegistrations(toolId)?.pluginRefs;
      if (refs !== undefined && refs.length > 0) nativeRefs.set(toolId, refs);
    }
    await detachNativePluginRefs(this.userManifestRepo, this.fs, options.projectRoot, nativeRefs);
    for (const toolId of manifest.getInstalledToolIds()) {
      if (!options.tools.isAiTool(toolId)) continue;
      for (const plugin of manifest.getPlugins(toolId)) {
        if (plugin.scope === "user") {
          await detachUserPlugin(
            this.userManifestRepo,
            this.fs,
            toolId,
            plugin.name,
            options.projectRoot
          );
        }
      }
    }
    return { dryRun: false, manifestFound: true, preview, fileCount: deleted };
  }

  // `config.json` is a committed file clean did not write, so clean never
  // removes it. Everything AIDD did write must go before the emptiness check, or its own presence
  // blocks a removal that should happen — the registry `marketplace add` writes included.
  private async removeAiddState(projectRoot: string): Promise<void> {
    const aiddDir = join(projectRoot, AIDD_DIR);
    const configKept = await this.fs.fileExists(join(aiddDir, AIDD_CONFIG_FILENAME));

    await this.fs.deleteDirectory(join(aiddDir, "cache"));
    await this.fs.deleteDirectory(join(projectRoot, PLUGIN_CACHE_SUBDIR));
    await this.fs.deleteFile(join(aiddDir, AIDD_MARKETPLACES_FILENAME));
    await this.manifestRepo.delete();

    if (!(await this.fs.fileExists(aiddDir))) return;
    const remaining = await this.fs.listDirectory(aiddDir);
    if (remaining.length === 0) {
      await this.fs.deleteDirectory(aiddDir);
      return;
    }
    if (configKept) this.logger.info(`Kept ${AIDD_DIR}/${AIDD_CONFIG_FILENAME}`);
  }

  /** The AI tools whose host holds registrations this project made. A non-AI tool never does;
   * were one recorded, it is left out rather than guessed at. */
  private projectWithdrawals(
    manifest: Manifest,
    home: string,
    tools: ToolCatalog
  ): ProjectRegistrationWithdrawal[] {
    const withdrawals: ProjectRegistrationWithdrawal[] = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      const registrations = manifest.getNativeRegistrations(toolId);
      if (registrations === undefined || !tools.isAiTool(toolId)) continue;
      const tool = tools.aiProfile(toolId);
      const refScopes = new Map<string, MarketplaceScope>();
      for (const plugin of manifest.getPlugins(toolId)) {
        const hostName = registrations.marketplaces.find(
          (m) => m.alias === plugin.marketplace
        )?.hostName;
        if (hostName !== undefined) refScopes.set(`${plugin.name}@${hostName}`, plugin.scope);
      }
      withdrawals.push({
        tool,
        registrations,
        cacheRoot: tool.nativeActivation()?.pluginCacheRoot(home),
        refScopes,
      });
    }
    return withdrawals;
  }

  private async marketplaceScopes(projectRoot: string): Promise<Map<string, MarketplaceScope>> {
    const marketplaces = (await this.marketplaceRegistry?.list(projectRoot)) ?? [];
    return new Map(marketplaces.map((m) => [m.name, m.scope]));
  }

  private cleanFacts(
    projectRoot: string,
    marketplaceScopes: ReadonlyMap<string, MarketplaceScope>
  ): ProjectCleanFacts {
    const repo = this.userManifestRepo;
    return {
      projectRoot,
      marketplaceScopes,
      sharedSource: undefined,
      frameworkAlias: FRAMEWORK_MARKETPLACE_NAME,
      machineClaims: async (toolId) => {
        const machine = await repo?.load();
        if (machine === undefined || machine === null) return undefined;
        return machine.getNativeRegistrations(toolId)?.pluginClaims ?? [];
      },
      exclusive: (action) => (repo === undefined ? action() : repo.withExclusiveAccess(action)),
      resolveCacheCandidate: (cacheRoot, segments, label) =>
        resolveCacheCandidate(this.fs, this.logger, cacheRoot, segments, label),
    };
  }

  /** Decrements this project's claim exactly once after local cleanup. The resolved root was
   * captured before `.aidd/` and its local marketplace registry were deleted. */
  private async dropSharedSourceReference(resolvedRoot: string | undefined): Promise<void> {
    const references = this.userSourceReferences;
    if (references === undefined || resolvedRoot === undefined) return;
    await toleratingUnreadableSourceReferences(this.logger, undefined, () =>
      references.removeReference(resolvedRoot)
    );
  }

  /** Shared preamble behind the cleanup read and `previewSharedSourceOtherProjects`:
   * `undefined` when the port was never wired in or no shared, machine-scope registration exists
   * to act on. `action` alone decides whether the run only reads or also writes. */
  private async withSharedSourceClaims<T>(
    projectRoot: string,
    action: (
      userSourceReferences: UserSourceReferences,
      sharedAlias: string,
      resolvedRoot: string
    ) => Promise<T>
  ): Promise<T | undefined> {
    if (this.userSourceReferences === undefined) return undefined;
    const marketplaces = (await this.marketplaceRegistry?.list(projectRoot)) ?? [];
    const shared = marketplaces.find((m) => frameworkSourceIsShared(m.name, m.scope));
    if (shared === undefined) return undefined;
    const userSourceReferences = this.userSourceReferences;
    return toleratingUnreadableSourceReferences(this.logger, undefined, async () => {
      const resolvedRoot = await resolveProjectRootForReferences(this.fs, projectRoot);
      return action(userSourceReferences, shared.name, resolvedRoot);
    });
  }

  /** The files a tool writes that `plugins[].files` never tracks: a machine-local settings file
   * (`.claude/settings.local.json`) and, for a tool merging a plugin's hooks into its own project
   * file (`.cursor/hooks.json`), the same unmerge `plugin remove` drives one plugin at a time. */
  private async deleteMachineLocalFiles(
    manifest: Manifest,
    projectRoot: string,
    tools: ToolCatalog,
    hooksGuard: ProjectHooksGuard
  ): Promise<number> {
    let count = 0;
    for (const toolId of manifest.getInstalledToolIds()) {
      count += await this.deleteMachineLocalSettingsFiles(toolId, projectRoot, tools);
      count += await this.removeProjectHooksForTool(
        manifest,
        toolId,
        tools,
        projectRoot,
        hooksGuard
      );
    }
    return count;
  }

  private async deleteMachineLocalSettingsFiles(
    toolId: ToolId,
    projectRoot: string,
    tools: ToolCatalog
  ): Promise<number> {
    let count = 0;
    for (const relativePath of machineLocalFilesOf(tools, toolId)) {
      const fullPath = join(projectRoot, relativePath);
      if (!(await this.fs.fileExists(fullPath))) continue;
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
      count++;
    }
    return count;
  }

  private async removeProjectHooksForTool(
    manifest: Manifest,
    toolId: ToolId,
    tools: ToolCatalog,
    projectRoot: string,
    hooksGuard: ProjectHooksGuard
  ): Promise<number> {
    if (!tools.isAiTool(toolId) || tools.aiProfile(toolId).projectHooksDelivery() === null)
      return 0;
    let count = 0;
    for (const plugin of manifest.getPlugins(toolId)) {
      if (
        await removeProjectHooks(this.fs, plugin, tools.aiProfile(toolId), projectRoot, hooksGuard)
      )
        count++;
    }
    return count;
  }

  private async buildPreview(
    manifest: Manifest,
    home: string,
    projectRoot: string,
    profiles: ToolCatalog
  ): Promise<CleanPreview> {
    const tools = manifest.getInstalledToolIds().map((toolId) => ({
      toolId,
      fileCount: manifest.getToolFiles(toolId).length + manifest.getMergeFiles(toolId).length,
    }));
    const totalFileCount = tools.reduce((s, t) => s + t.fileCount, 0);
    const nativeRegistrations = this.previewNativeRegistrations(manifest, home, profiles);
    const sharedSourceOtherProjects = await this.previewSharedSourceOtherProjects(projectRoot);
    return { tools, totalFileCount, nativeRegistrations, sharedSourceOtherProjects };
  }

  /** Read-only counterpart to `dropSharedSourceReference`: a dry-run must never write. Reads
   * across every version key, so two projects synced under two different CLI versions see the
   * same "other projects" fact from `aidd clean` as from `aidd clean --force`. */
  private async previewSharedSourceOtherProjects(
    projectRoot: string
  ): Promise<readonly string[] | undefined> {
    return this.withSharedSourceClaims(projectRoot, (userSourceReferences, _alias, resolvedRoot) =>
      otherProjectsReferencing(userSourceReferences, resolvedRoot)
    );
  }

  private previewNativeRegistrations(
    manifest: Manifest,
    home: string,
    tools: ToolCatalog
  ): CleanPreview["nativeRegistrations"] {
    const preview: CleanPreview["nativeRegistrations"] = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      const registrations = manifest.getNativeRegistrations(toolId);
      if (registrations === undefined) continue;
      const cacheRoot = tools.isAiTool(toolId)
        ? tools.aiProfile(toolId).nativeActivation()?.pluginCacheRoot(home)
        : undefined;
      preview.push({
        toolId,
        binary: registrations.binary,
        marketplaceCount: registrations.marketplaces.length,
        pluginRefCount: registrations.pluginRefs.length,
        cachePaths:
          cacheRoot === undefined
            ? []
            : registrations.marketplaces.map((m) => join(cacheRoot, m.hostName)),
      });
    }
    return preview;
  }

  private async confirmOrDryRun(
    options: CleanOptions,
    preview: CleanPreview
  ): Promise<CleanResult | null> {
    if (options.force) return null;
    if (options.interactive && this.prompter) {
      const confirmed = await this.prompter.confirm("Remove all AIDD files?");
      if (!confirmed) return { dryRun: true, manifestFound: true, preview, fileCount: 0 };
      return null;
    }
    return { dryRun: true, manifestFound: true, preview, fileCount: 0 };
  }

  private async deleteAllToolFiles(
    manifest: Manifest,
    tools: ToolCatalog,
    projectRoot: string
  ): Promise<number> {
    let deleted = 0;
    for (const toolId of manifest.getInstalledToolIds()) {
      this.logger.info(`Removing ${toolId} files...`);
      deleted += await this.deleteFiles(manifest.getToolFiles(toolId), projectRoot);
      deleted += await this.cleanMergeFileKeys(manifest.getMergeFiles(toolId), projectRoot);
      if (tools.isAiTool(toolId)) {
        deleted += await this.deleteToolPluginFiles(manifest, tools.aiProfile(toolId), projectRoot);
      }
    }
    return deleted;
  }

  private async deleteToolPluginFiles(
    manifest: Manifest,
    tool: AiToolProfile,
    projectRoot: string
  ): Promise<number> {
    let count = 0;
    const toolId = tool.toolId;
    for (const plugin of manifest.getPlugins(toolId)) {
      if (plugin.scope === "user") continue;
      const files = await this.filesSafeToDelete(plugin, tool);
      const deleted = await deletePluginFilesForTool(
        files,
        plugin.scope,
        tool,
        projectRoot,
        this.fs
      );
      count += deleted.length;
    }
    return count;
  }

  /** For a project-scope plugin every tracked file is safe: it lives under `projectRoot`, which
   * `clean` is already trusted with. A user-scope plugin's files go through
   * `userScopeFilesSafeToDelete`, where a raw path comparison would miss both a `..` segment and
   * a symlink escape. */
  private async filesSafeToDelete(
    plugin: InstalledPlugin,
    tool: AiToolProfile
  ): Promise<ReadonlyMap<string, string>> {
    if (plugin.scope !== "user") return plugin.files;
    return userScopeFilesSafeToDelete(this.fs, this.logger, plugin, tool, this.homeDir());
  }

  private async cleanMergeFileKeys(
    mergeFiles: readonly MergeFileEntry[],
    projectRoot: string
  ): Promise<number> {
    let count = 0;
    for (const mergeFile of mergeFiles) {
      const fullPath = join(projectRoot, mergeFile.relativePath);
      if (!(await this.fs.fileExists(fullPath))) continue;
      await this.applyMergeFileCleaning(fullPath, mergeFile);
      count++;
    }
    return count;
  }

  private async applyMergeFileCleaning(fullPath: string, mergeFile: MergeFileEntry): Promise<void> {
    const keys = Object.keys(mergeFile.entries);
    if (keys.length === 0) {
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
      return;
    }
    const content = await this.fs.readFile(fullPath);
    const cleaned = removeEntriesFromJson(content, mergeFile.sectionKey, keys);
    if (isMergeContentEmpty(cleaned, mergeFile.sectionKey)) {
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
    } else {
      await this.fs.writeFile(fullPath, cleaned);
    }
  }

  private async deleteFiles(
    files: ReadonlyArray<{ relativePath: string }>,
    projectRoot: string
  ): Promise<number> {
    let count = 0;
    for (const file of files) {
      const fullPath = join(projectRoot, file.relativePath);
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
      count++;
    }
    return count;
  }
}
