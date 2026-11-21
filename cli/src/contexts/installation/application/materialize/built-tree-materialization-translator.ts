import type { InstallationFile } from "../../../../shared/domain/installation-file.js";
import type { ReadonlySkipList } from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import type { Scope } from "../../../../shared/domain/scope.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { FrameworkBuildMode } from "../../../tools/contract/tool-profile.js";
import type { MarketplaceToBuild } from "../../contract/built-marketplace.js";
/**
 * Materializes plugin content by copying the per-target BUILT tree verbatim into the tool's plugin
 * directory, bypassing the per-file transform the build already applied. Marketplace-sourced
 * installs only; a raw local-path install falls back to flat materialization.
 */
import { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ProjectHooksProvenance } from "../../domain/plugins/plugin-entry.js";
import { resolveScopeForInstall, scopeBaseOf } from "../plugin/plugin-target-resolution.js";
import { writeChangedPluginFiles } from "../plugin/write-changed-plugin-files.js";
import type { BuiltMaterializationDeps } from "../shared/built-materialization-deps.js";
import { materializeRequestedMcp } from "./flat-mcp-materializer.js";
import { ModeBFlatMaterializationTranslator } from "./mode-b-flat-materialization-translator.js";
import type { AddPluginRequest, AddPluginResult, PluginTranslator } from "./plugin-translator.js";
import { ProjectHooksMaterializer } from "./project-hooks-materializer.js";
import {
  readBuiltFlatFiles,
  readBuiltUserPluginFiles,
  withoutHooksPrefix,
} from "./read-built-plugin-files.js";
export class BuiltTreeMaterializationTranslator implements PluginTranslator {
  readonly mode = "flat" as const;
  private readonly projectHooks: ProjectHooksMaterializer;

  constructor(
    private readonly fs: FileWriter & FileReader,
    private readonly built: BuiltMaterializationDeps
  ) {
    this.projectHooks = new ProjectHooksMaterializer(fs);
  }

  async addPlugin(request: AddPluginRequest): Promise<AddPluginResult> {
    const { dist, tool, source, projectRoot, manifest, marketplace } = request;
    const resolved =
      marketplace === undefined ? null : await this.findMarketplace(marketplace, projectRoot);
    if (marketplace === undefined || resolved === null) {
      return this.fallback().addPlugin(request);
    }
    const mode = tool.frameworkBuildMode();
    const { files, hooks } = await this.readBuiltContent(request, { marketplace: resolved, mode });
    const mcp = await this.mergeMcp(request);
    const scope = resolveScopeForInstall(tool);
    const owned = request.userScopeDirTaken === true ? [] : files;
    const written = await writeChangedPluginFiles(
      this.fs,
      owned,
      this.baseDirOf(request, mode, scope)
    );
    manifest.addPlugin(
      tool.toolId,
      InstalledPlugin.withProjectHooks(
        InstalledPlugin.fromDistributionWithMcp({
          dist,
          source,
          files: owned,
          mcpEntries: mcp.mcpEntries,
          scope,
          componentPaths: new Map(),
          marketplace,
        }),
        hooks.projectHooks
      )
    );
    return { skipped: [...mcp.mcpSkips, ...hooks.skipped], written };
  }

  // The built tree still carries a plugin's hooks for a capability declaring `hooksDestination:
  // "project"`: dropped from the plugin's files, recorded once, by the project-hooks side channel
  // the local-source route uses, so both land where the tool's own declaration says.
  private async readBuiltContent(
    request: AddPluginRequest,
    build: { marketplace: MarketplaceToBuild; mode: FrameworkBuildMode }
  ): Promise<{
    files: InstallationFile[];
    hooks: { skipped: ReadonlySkipList; projectHooks?: ProjectHooksProvenance };
  }> {
    const { dist, tool, projectRoot, previousProjectHooks, hooksGuard = {} } = request;
    const { builtDir } = await this.built.ensureBuilt.execute({
      projectRoot,
      marketplace: build.marketplace,
      target: tool.toolId,
      mode: build.mode,
    });
    const deliversHooksToProject = tool.plugins()?.deliversHooksToProject() === true;
    const builtFiles =
      build.mode === "flat"
        ? await readBuiltFlatFiles(
            this.fs,
            { builtDir, platform: this.built.platform },
            {
              name: dist.manifest.name,
              tool,
              extraPaths: deliversHooksToProject
                ? new Set<string>()
                : this.built.translate.execute({ distribution: dist, tool }).flatHookPaths,
            }
          )
        : await readBuiltUserPluginFiles(this.fs, {
            builtDir,
            name: dist.manifest.name,
            platform: this.built.platform,
          });
    if (!deliversHooksToProject) return { files: builtFiles, hooks: { skipped: [] } };
    const hooks = await this.projectHooks.execute({
      dist,
      hooks: this.built.translate.execute({ distribution: dist, tool }).projectHooks,
      tool,
      projectRoot,
      previous: previousProjectHooks,
      guard: hooksGuard,
    });
    return { files: withoutHooksPrefix(builtFiles, dist.manifest.name), hooks };
  }

  private mergeMcp(request: AddPluginRequest) {
    const { dist, tool } = request;
    const { installedMcp } = this.built.translate.execute({ distribution: dist, tool });
    return materializeRequestedMcp(this.fs, request, installedMcp);
  }

  private baseDirOf(request: AddPluginRequest, mode: FrameworkBuildMode, scope: Scope): string {
    const { tool, projectRoot } = request;
    return mode === "flat"
      ? projectRoot
      : scopeBaseOf(tool, { scope, projectRoot, homedir: () => this.built.homedir() });
  }

  private async findMarketplace(name: string, projectRoot: string) {
    const all = await this.built.marketplaceRegistry.list(projectRoot);
    return all.find((m) => m.name === name) ?? null;
  }

  private fallback(): ModeBFlatMaterializationTranslator {
    return new ModeBFlatMaterializationTranslator(
      this.fs,
      this.built.homedir,
      this.built.translate
    );
  }
}
