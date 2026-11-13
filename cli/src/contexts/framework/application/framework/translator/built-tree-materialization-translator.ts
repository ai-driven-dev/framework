import { join, posix } from "node:path";
import { InstallationFile } from "../../../../../kernel/file.js";
import { posixRelative } from "../../../../../kernel/paths.js";
import type { FileReader } from "../../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../../kernel/ports/file-writer.js";
import type { Hasher } from "../../../../../kernel/ports/hasher.js";
import type { PluginSource } from "../../../../../kernel/source.js";
import type { MarketplaceRegistry } from "../../../../distribution/ports/marketplace-registry.js";
import type { AiToolProfile } from "../../../../tools/contract/tool-profile.js";
/**
 * Materializes plugin content by copying the per-target BUILT tree verbatim into the tool's plugin
 * directory, bypassing the per-file transform the build already applied. Marketplace-sourced
 * installs only; a raw local-path install falls back to flat materialization.
 */
import { PluginContentTranslator } from "../../../../translate/domain/content-translator.js";
import type { PluginDistribution } from "../../../../translate/domain/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../../translate/domain/plugin-translation-skip.js";
import type { Manifest } from "../../../domain/manifest.js";
import {
  InstalledPlugin,
  type ProjectHooksProvenance,
} from "../../../domain/plugins/installed-plugin.js";
import { isPluginFileAtDesiredState } from "../../plugin/plugin-helpers.js";
import {
  resolveBaseDirFromRecord,
  resolveScopeForInstall,
} from "../../plugin/plugin-target-resolution.js";
import type { EnsureBuiltMarketplace } from "../../shared/ensure-built-marketplace-use-case.js";
import type { ProjectHooksGuard } from "../../shared/remove-project-hooks.js";
import { materializeFlatMcp, refreshTrackedMcpConfigHash } from "./flat-mcp-materializer.js";
import { ModeBFlatMaterializationTranslator } from "./mode-b-flat-materialization-translator.js";
import type { PluginTranslator } from "./plugin-translator.js";
import { ProjectHooksMaterializer } from "./project-hooks-materializer.js";
export class BuiltTreeMaterializationTranslator implements PluginTranslator {
  readonly mode = "flat" as const;
  private readonly projectHooks: ProjectHooksMaterializer;

  constructor(
    private readonly fs: FileWriter & FileReader,
    private readonly hasher: Hasher,
    private readonly homedir: () => string,
    private readonly ensureBuilt: EnsureBuiltMarketplace,
    private readonly marketplaceRegistry: MarketplaceRegistry
  ) {
    this.projectHooks = new ProjectHooksMaterializer(fs);
  }

  async addPlugin(
    dist: PluginDistribution,
    tool: AiToolProfile,
    source: PluginSource,
    projectRoot: string,
    manifest: Manifest,
    marketplace: string | undefined,
    previousMcpEntries: ReadonlyMap<string, string> = new Map(),
    userScopeDirTaken = false,
    previousProjectHooks?: ProjectHooksProvenance,
    hooksGuard: ProjectHooksGuard = {}
  ): Promise<{ skipped: ReadonlySkipList; written?: number }> {
    const resolved =
      marketplace === undefined ? null : await this.findMarketplace(marketplace, projectRoot);
    if (marketplace === undefined || resolved === null) {
      return this.fallback().addPlugin(
        dist,
        tool,
        source,
        projectRoot,
        manifest,
        marketplace,
        previousMcpEntries,
        userScopeDirTaken,
        previousProjectHooks,
        hooksGuard
      );
    }
    const mode = tool.frameworkBuildMode();
    const { builtDir } = await this.ensureBuilt.execute({
      projectRoot,
      marketplace: resolved,
      target: tool.toolId,
      mode,
    });
    // The built tree still carries a plugin's hooks for a capability declaring `hooksDestination:
    // "project"`: dropped from the plugin's files, recorded once, by the project-hooks side channel
    // the local-source route uses, so both land where the tool's own declaration says.
    const deliversHooksToProject = tool.plugins()?.deliversHooksToProject() === true;
    const builtFiles =
      mode === "flat"
        ? await this.readFlatFiles(builtDir, dist, tool, deliversHooksToProject)
        : await readBuiltUserPluginFiles(this.fs, this.hasher, builtDir, dist.manifest.name);
    const hooks = deliversHooksToProject
      ? await this.projectHooks.materializeWithProvenance(
          dist,
          tool,
          projectRoot,
          previousProjectHooks,
          hooksGuard
        )
      : { skipped: [] as ReadonlySkipList };
    const files = deliversHooksToProject
      ? withoutHooksPrefix(builtFiles, dist.manifest.name)
      : builtFiles;
    const mcp = await materializeFlatMcp(
      this.fs,
      this.hasher,
      dist,
      tool,
      projectRoot,
      previousMcpEntries
    );
    await refreshTrackedMcpConfigHash(
      this.fs,
      manifest,
      tool.toolId,
      projectRoot,
      mcp.outputRelPath
    );
    const scope = resolveScopeForInstall(tool);
    const baseDir =
      mode === "flat"
        ? projectRoot
        : resolveBaseDirFromRecord(scope, tool, projectRoot, this.homedir);
    const owned = userScopeDirTaken ? [] : files;
    const written = await this.writeChangedFiles(owned, baseDir);
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

  // Skips a file already matching the built content on disk, so a no-op restore reports (and
  // performs) zero writes.
  private async writeChangedFiles(files: InstallationFile[], baseDir: string): Promise<number> {
    let written = 0;
    for (const f of files) {
      const outputPath = join(baseDir, f.relativePath);
      if (await isPluginFileAtDesiredState(this.fs, this.hasher, outputPath, f.hash.value)) {
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
  // the plugin's name in the loader's directory — so hook paths are matched by path, not by name.
  private async readFlatFiles(
    builtDir: string,
    dist: PluginDistribution,
    tool: AiToolProfile,
    deliversHooksToProject: boolean
  ): Promise<InstallationFile[]> {
    const name = dist.manifest.name;
    const hookPaths = deliversHooksToProject
      ? new Set<string>()
      : new PluginContentTranslator(this.hasher).flatHookPaths(dist, tool);
    const absPaths = await this.fs.listFilesRecursive(builtDir);
    const files: InstallationFile[] = [];
    for (const abs of absPaths) {
      const rel = posixRelative(builtDir, abs);
      if (!this.belongsToPlugin(rel, name, tool) && !hookPaths.has(rel)) continue;
      const content = await this.fs.readFile(abs);
      files.push(
        new InstallationFile({ relativePath: rel, content, hash: this.hasher.hash(content) })
      );
    }
    return files;
  }

  private belongsToPlugin(rel: string, name: string, tool: AiToolProfile): boolean {
    return tool.ownsFlatPath(rel, name);
  }

  private async findMarketplace(name: string, projectRoot: string) {
    const all = await this.marketplaceRegistry.list(projectRoot);
    return all.find((m) => m.name === name) ?? null;
  }

  private fallback(): ModeBFlatMaterializationTranslator {
    return new ModeBFlatMaterializationTranslator(this.fs, this.hasher, this.homedir);
  }
}

export async function readBuiltUserPluginFiles(
  fs: FileReader,
  hasher: Hasher,
  builtDir: string,
  name: string
): Promise<InstallationFile[]> {
  const pluginSrc = join(builtDir, "plugins", name);
  const absPaths = await fs.listFilesRecursive(pluginSrc);
  return Promise.all(
    absPaths.map(async (abs) => {
      const rel = posixRelative(pluginSrc, abs);
      const content = await fs.readFile(abs);
      return new InstallationFile({
        relativePath: posix.join(name, rel),
        content,
        hash: hasher.hash(content),
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
