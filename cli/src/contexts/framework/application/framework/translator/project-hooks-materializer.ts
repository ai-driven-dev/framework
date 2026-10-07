import { dirname, join } from "node:path";
import {
  cursorProjectHooksScriptPath,
  mergeCursorProjectHooksJson,
} from "../../../../../contexts/tools/domain/formats/cursor-hooks-project-merge.js";
import type { FileReader } from "../../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../../kernel/ports/file-writer.js";
import type { AiToolId } from "../../../../../kernel/tool.js";
import { resolvePluginsCapability } from "../../../../tools/domain/registry.js";
import {
  type PluginComponentFile,
  PluginDistribution,
} from "../../../../translate/domain/plugin-distribution.js";
import type {
  PluginTranslationSkip,
  ReadonlySkipList,
} from "../../../../translate/domain/plugin-translation-skip.js";
import type { ProjectHooksProvenance } from "../../../domain/plugins/installed-plugin.js";
import {
  assertProjectHooksUnchanged,
  recordedProjectHookEntries,
  removeRecordedProjectHooks,
} from "../../shared/remove-project-hooks.js";

const HOOKS_MANIFEST_PATH = "hooks/hooks.json";

/**
 * Delivers a plugin's hooks to the destination a `hooksDestination: "project"` capability names —
 * merged into the project's own hooks file, scripts copied beside it — rather than into the
 * plugin's own directory. Both materialization routes call it, so where a tool's hooks land is
 * decided by its own declaration, never by which translator happened to run.
 */
export class ProjectHooksMaterializer {
  constructor(private readonly fs: FileWriter & FileReader) {}

  async materialize(
    dist: PluginDistribution,
    toolId: AiToolId,
    projectRoot: string
  ): Promise<ReadonlySkipList> {
    return (await this.materializeWithProvenance(dist, toolId, projectRoot)).skipped;
  }

  async materializeWithProvenance(
    dist: PluginDistribution,
    toolId: AiToolId,
    projectRoot: string,
    previous?: ProjectHooksProvenance
  ): Promise<{ skipped: ReadonlySkipList; projectHooks?: ProjectHooksProvenance }> {
    const pluginsCap = resolvePluginsCapability(toolId);
    if (pluginsCap === null || pluginsCap.hooksDestination !== "project") return { skipped: [] };
    const projectHooksRelativePath = pluginsCap.projectHooksRelativePath;
    if (projectHooksRelativePath === null) return { skipped: [] };
    const manifestFile = dist.components.hooks.find((f) => f.relativePath === HOOKS_MANIFEST_PATH);
    if (manifestFile === undefined) {
      if (previous !== undefined) {
        await removeRecordedProjectHooks(
          this.fs,
          dist.manifest.name,
          previous,
          toolId,
          projectRoot
        );
      }
      return { skipped: [] };
    }
    await assertProjectHooksUnchanged(this.fs, dist.manifest.name, previous, toolId, projectRoot);
    await this.assertScriptsNotUserOwned(dist, projectRoot, previous);
    const { warnings, entries } = await this.mergeProjectHooksJson(
      dist,
      manifestFile,
      projectRoot,
      projectHooksRelativePath
    );
    const scripts = await this.writeProjectHooksScripts(dist, projectRoot);
    await this.removeObsoleteScripts(previous, scripts, projectRoot);
    return {
      skipped: warnings.map(
        (reason): PluginTranslationSkip => ({
          pluginName: dist.manifest.name,
          component: "hooks",
          toolId,
          reason,
        })
      ),
      projectHooks: { entries, scripts },
    };
  }

  private async mergeProjectHooksJson(
    dist: PluginDistribution,
    manifestFile: PluginComponentFile,
    projectRoot: string,
    projectHooksRelativePath: string
  ): Promise<{ warnings: readonly string[]; entries: ProjectHooksProvenance["entries"] }> {
    const destPath = join(projectRoot, projectHooksRelativePath);
    const existing = await this.readExistingJson(destPath);
    const { content, warnings } = mergeCursorProjectHooksJson(
      existing,
      manifestFile.content,
      dist.manifest.name
    );
    await this.fs.writeFile(destPath, content);
    return { warnings, entries: recordedProjectHookEntries(content, dist.manifest.name) };
  }

  private async assertScriptsNotUserOwned(
    dist: PluginDistribution,
    projectRoot: string,
    previous?: ProjectHooksProvenance
  ): Promise<void> {
    for (const file of dist.components.hooks) {
      if (file.relativePath === HOOKS_MANIFEST_PATH) continue;
      const relativePath = cursorProjectHooksScriptPath(dist.manifest.name, file.relativePath);
      if (previous?.scripts.has(relativePath) === true) continue;
      if (await this.fs.fileExists(join(projectRoot, relativePath))) {
        throw new Error(`Cursor hook script '${relativePath}' is user-owned; install refused.`);
      }
    }
  }

  private async writeProjectHooksScripts(
    dist: PluginDistribution,
    projectRoot: string
  ): Promise<ReadonlyMap<string, string>> {
    const scripts = new Map<string, string>();
    for (const file of dist.components.hooks) {
      if (file.relativePath === HOOKS_MANIFEST_PATH) continue;
      const dest = cursorProjectHooksScriptPath(dist.manifest.name, file.relativePath);
      await this.fs.writeFile(join(projectRoot, dest), file.content);
      scripts.set(dest, (await this.fs.readFileHash(join(projectRoot, dest))).value);
    }
    return scripts;
  }

  private async removeObsoleteScripts(
    previous: ProjectHooksProvenance | undefined,
    current: ReadonlyMap<string, string>,
    projectRoot: string
  ): Promise<void> {
    if (previous === undefined) return;
    for (const [relativePath, digest] of previous.scripts) {
      if (current.has(relativePath)) continue;
      const path = join(projectRoot, relativePath);
      if (!(await this.fs.fileExists(path))) continue;
      if ((await this.fs.readFileHash(path)).value !== digest) {
        throw new Error(
          `Cursor hook script '${relativePath}' was edited during reinstall; removal refused.`
        );
      }
      await this.fs.deleteFile(path);
      await this.fs.deleteEmptyDirectories(dirname(path));
    }
  }

  private async readExistingJson(path: string): Promise<string | null> {
    try {
      return await this.fs.readFile(path);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }
}

/** A copy of `dist` with every `hooks/` file dropped, from `files` and from `components.hooks`
 * alike — for a capability declaring `hooksDestination: "project"`, so none of its hooks are
 * written under the plugin's own directory, only through `materialize`. */
export function withoutHooks(dist: PluginDistribution): PluginDistribution {
  return new PluginDistribution({
    manifest: dist.manifest,
    format: dist.format,
    files: dist.files.filter((f) => f.relativePath.split("/")[0] !== "hooks"),
    components: { ...dist.components, hooks: [] },
  });
}
