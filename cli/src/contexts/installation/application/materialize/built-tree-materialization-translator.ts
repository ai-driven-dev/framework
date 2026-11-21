import { join, posix } from "node:path";
import { FileHash } from "../../../../shared/domain/file-hash.js";
import { InstallationFile } from "../../../../shared/domain/installation-file.js";
import { posixRelative } from "../../../../shared/domain/paths.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import type { Scope } from "../../../../shared/domain/scope.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
/**
 * Materializes plugin content by copying the per-target BUILT tree verbatim into the tool's plugin
 * directory, bypassing the per-file transform the build already applied. Marketplace-sourced
 * installs only; a raw local-path install falls back to flat materialization.
 */
import {
  InstalledPlugin,
  type ProjectHooksProvenance,
} from "../../domain/plugins/installed-plugin.js";
import { isPluginFileAtDesiredState } from "../plugin/plugin-helpers.js";
import { resolveScopeForInstall, scopeBaseOf } from "../plugin/plugin-target-resolution.js";
import type { BuiltMaterializationDeps } from "../shared/built-materialization-deps.js";
import { materializeFlatMcp, refreshTrackedMcpConfigHash } from "./flat-mcp-materializer.js";
import { ModeBFlatMaterializationTranslator } from "./mode-b-flat-materialization-translator.js";
import type { AddPluginRequest, AddPluginResult, PluginTranslator } from "./plugin-translator.js";
import { ProjectHooksMaterializer } from "./project-hooks-materializer.js";
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
    const { previousMcpEntries = new Map(), userScopeDirTaken = false } = request;
    const mode = tool.frameworkBuildMode();
    const { builtDir } = await this.built.ensureBuilt.execute({
      projectRoot,
      marketplace: resolved,
      target: tool.toolId,
      mode,
    });
    const { files, hooks } = await this.readBuiltContent(request, { builtDir, mode });
    const mcp = await materializeFlatMcp({
      fs: this.fs,
      dist,
      tool,
      projectRoot,
      previousMcpEntries,
    });
    await refreshTrackedMcpConfigHash({
      fs: this.fs,
      manifest,
      toolId: tool.toolId,
      projectRoot,
      outputRelPath: mcp.outputRelPath,
    });
    const scope = resolveScopeForInstall(tool);
    const owned = userScopeDirTaken ? [] : files;
    const written = await this.writeChangedFiles(owned, this.baseDirOf(request, mode, scope));
    manifest.addPlugin(
      tool.toolId,
      InstalledPlugin.withProjectHooks(
        InstalledPlugin.fromDistributionWithMcp(
          dist,
          source,
          owned,
          mcp.mcpEntries,
          scope,
          new Map(),
          marketplace
        ),
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
    built: { builtDir: string; mode: string }
  ): Promise<{
    files: InstallationFile[];
    hooks: { skipped: ReadonlySkipList; projectHooks?: ProjectHooksProvenance };
  }> {
    const { dist, tool, projectRoot, previousProjectHooks, hooksGuard = {} } = request;
    const deliversHooksToProject = tool.plugins()?.deliversHooksToProject() === true;
    const builtFiles =
      built.mode === "flat"
        ? await this.readFlatFiles({ builtDir: built.builtDir, dist, tool, deliversHooksToProject })
        : await readBuiltUserPluginFiles(this.fs, {
            builtDir: built.builtDir,
            name: dist.manifest.name,
            platform: this.built.platform,
          });
    if (!deliversHooksToProject) return { files: builtFiles, hooks: { skipped: [] } };
    const hooks = await this.projectHooks.execute({
      dist,
      tool,
      projectRoot,
      previous: previousProjectHooks,
      guard: hooksGuard,
    });
    return { files: withoutHooksPrefix(builtFiles, dist.manifest.name), hooks };
  }

  private baseDirOf(request: AddPluginRequest, mode: string, scope: Scope): string {
    const { tool, projectRoot } = request;
    return mode === "flat"
      ? projectRoot
      : scopeBaseOf(tool, { scope, projectRoot, homedir: () => this.built.homedir() });
  }

  // Skips a file already matching the built content on disk, so a no-op restore reports (and
  // performs) zero writes.
  private async writeChangedFiles(files: InstallationFile[], baseDir: string): Promise<number> {
    let written = 0;
    for (const f of files) {
      const outputPath = join(baseDir, f.relativePath);
      if (await isPluginFileAtDesiredState(this.fs, outputPath, f.hash.value)) {
        continue;
      }
      await this.fs.writeFile(outputPath, f.content);
      written++;
    }
    return written;
  }

  // Flat build emits the whole marketplace into one workspace. Agents are namespaced by
  // `<plugin>-<name>`; skills keep their subtree intact, since a skill's script can `require()` a
  // sibling by relative path, under `skills/<plugin>/` or, `single-level`, `skills/<plugin>-<skill>/`.
  // Hooks land under `flatHooksDir/<plugin>/`, except the loader's own runtime module, renamed to
  // the plugin's name in the loader's directory: so hook paths are matched by path, not by name.
  private async readFlatFiles(read: {
    builtDir: string;
    dist: PluginDistribution;
    tool: AiToolProfile;
    deliversHooksToProject: boolean;
  }): Promise<InstallationFile[]> {
    const { builtDir, dist, tool, deliversHooksToProject } = read;
    const name = dist.manifest.name;
    const hookPaths = deliversHooksToProject
      ? new Set<string>()
      : this.built.translate.execute({ distribution: dist, tool }).flatHookPaths;
    const absPaths = await this.fs.listFilesRecursive(builtDir);
    const files: InstallationFile[] = [];
    for (const abs of absPaths) {
      const rel = posixRelative(builtDir, abs, this.built.platform);
      if (!this.belongsToPlugin(rel, name, tool) && !hookPaths.has(rel)) continue;
      const content = await this.fs.readFile(abs);
      files.push(new InstallationFile({ relativePath: rel, content, hash: FileHash.of(content) }));
    }
    return files;
  }

  private belongsToPlugin(rel: string, name: string, tool: AiToolProfile): boolean {
    return tool.ownsFlatPath(rel, name);
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

export async function readBuiltUserPluginFiles(
  fs: FileReader,
  built: { builtDir: string; name: string; platform: string }
): Promise<InstallationFile[]> {
  const { builtDir, name, platform } = built;
  const pluginSrc = join(builtDir, "plugins", name);
  const absPaths = await fs.listFilesRecursive(pluginSrc);
  return Promise.all(
    absPaths.map(async (abs) => {
      const rel = posixRelative(pluginSrc, abs, platform);
      const content = await fs.readFile(abs);
      return new InstallationFile({
        relativePath: posix.join(name, rel),
        content,
        hash: FileHash.of(content),
      });
    })
  );
}

// `readBuiltFiles` prefixes every path with `<name>/`, so a built-tree hooks file always reads
// `<name>/hooks/<rest>`.
export function withoutHooksPrefix(
  files: InstallationFile[],
  pluginName: string
): InstallationFile[] {
  const hooksPrefix = `${pluginName}/hooks/`;
  return files.filter((f) => !f.relativePath.startsWith(hooksPrefix));
}
