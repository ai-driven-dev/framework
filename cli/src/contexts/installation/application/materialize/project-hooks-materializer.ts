import { dirname, join } from "node:path";
import {
  type PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import type {
  PluginTranslationSkip,
  ReadonlySkipList,
} from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import { isErrnoException } from "../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { ProjectHooksLocation } from "../../../tools/contract/tool-vocabulary.js";
import type { ProjectHooksProvenance } from "../../domain/plugins/installed-plugin.js";
import type { ProjectHooksSection } from "../../ports/tool-sections.js";
import {
  assertProjectHooksUnchanged,
  OVERWRITE_EDITED_HINT,
  type ProjectHooksGuard,
  recordedProjectHookEntries,
  removeRecordedProjectHooks,
} from "../shared/remove-project-hooks.js";

const HOOKS_MANIFEST_PATH = "hooks/hooks.json";

export interface ProjectHooksMaterializerRequest {
  readonly dist: PluginDistribution;
  readonly tool: ProjectHooksSection;
  readonly projectRoot: string;
  readonly previous?: ProjectHooksProvenance;
  readonly guard?: ProjectHooksGuard;
}

export interface ProjectHooksMaterialized {
  readonly skipped: ReadonlySkipList;
  readonly projectHooks?: ProjectHooksProvenance;
}

/** One delivery of a plugin's hooks to the destination its tool declares. */
interface HooksDelivery {
  readonly dist: PluginDistribution;
  readonly projectRoot: string;
  readonly location: ProjectHooksLocation;
  readonly previous?: ProjectHooksProvenance;
  readonly guard: ProjectHooksGuard;
}

/**
 * Delivers a plugin's hooks to the destination a `hooksDestination: "project"` capability names -
 * merged into the project's own hooks file, scripts copied beside it: rather than into the
 * plugin's own directory. Both materialization routes call it, so where a tool's hooks land is
 * decided by its own declaration, never by which translator happened to run.
 */
export class ProjectHooksMaterializer {
  constructor(private readonly fs: FileWriter & FileReader) {}

  async execute({
    dist,
    tool,
    projectRoot,
    previous,
    guard = {},
  }: ProjectHooksMaterializerRequest): Promise<ProjectHooksMaterialized> {
    const location = tool.projectHooksDelivery();
    if (location === null) return { skipped: [] };
    const manifestFile = dist.components.hooks.find((f) => f.relativePath === HOOKS_MANIFEST_PATH);
    if (manifestFile === undefined) {
      if (previous !== undefined) {
        await removeRecordedProjectHooks({
          fs: this.fs,
          pluginName: dist.manifest.name,
          provenance: previous,
          tool,
          projectRoot,
          guard,
        });
      }
      return { skipped: [] };
    }
    await assertProjectHooksUnchanged({
      fs: this.fs,
      pluginName: dist.manifest.name,
      provenance: previous,
      tool,
      projectRoot,
      guard,
    });
    const delivery: HooksDelivery = { dist, projectRoot, location, previous, guard };
    await this.assertScriptsNotUserOwned(delivery);
    const { warnings, entries } = await this.mergeProjectHooksJson(delivery, manifestFile);
    const scripts = await this.writeProjectHooksScripts(delivery);
    await this.removeObsoleteScripts(delivery, scripts);
    return {
      skipped: warnings.map(
        (reason): PluginTranslationSkip => ({
          pluginName: dist.manifest.name,
          component: "hooks",
          toolId: tool.toolId,
          reason: `${tool.toolId}: ${reason}`,
        })
      ),
      projectHooks: { entries, scripts },
    };
  }

  private async mergeProjectHooksJson(
    { dist, projectRoot, location }: HooksDelivery,
    manifestFile: PluginComponentFile
  ): Promise<{ warnings: readonly string[]; entries: ProjectHooksProvenance["entries"] }> {
    const destPath = join(projectRoot, location.relativePath);
    const existing = await this.readExistingJson(destPath);
    const { content, warnings } = location.format.merge(
      existing,
      manifestFile.content,
      dist.manifest.name
    );
    await this.fs.writeFile(destPath, content);
    return {
      warnings,
      entries: recordedProjectHookEntries(location.format, content, dist.manifest.name),
    };
  }

  private async assertScriptsNotUserOwned({
    dist,
    projectRoot,
    location,
    previous,
  }: HooksDelivery): Promise<void> {
    for (const file of dist.components.hooks) {
      if (file.relativePath === HOOKS_MANIFEST_PATH) continue;
      const relativePath = location.format.scriptPath(dist.manifest.name, file.relativePath);
      if (previous?.scripts.has(relativePath) === true) continue;
      if (await this.fs.fileExists(join(projectRoot, relativePath))) {
        throw new Error(
          `${location.toolName} hook script '${relativePath}' is user-owned; install refused.`
        );
      }
    }
  }

  private async writeProjectHooksScripts({
    dist,
    projectRoot,
    location,
  }: HooksDelivery): Promise<ReadonlyMap<string, string>> {
    const scripts = new Map<string, string>();
    for (const file of dist.components.hooks) {
      if (file.relativePath === HOOKS_MANIFEST_PATH) continue;
      const dest = location.format.scriptPath(dist.manifest.name, file.relativePath);
      await this.fs.writeFile(
        join(projectRoot, dest),
        location.hookScript(file.relativePath, file.content)
      );
      scripts.set(dest, (await this.fs.readFileHash(join(projectRoot, dest))).value);
    }
    return scripts;
  }

  private async removeObsoleteScripts(
    { projectRoot, location, previous, guard }: HooksDelivery,
    current: ReadonlyMap<string, string>
  ): Promise<void> {
    if (previous === undefined) return;
    for (const [relativePath, digest] of previous.scripts) {
      if (current.has(relativePath)) continue;
      const path = join(projectRoot, relativePath);
      if (!(await this.fs.fileExists(path))) continue;
      if (guard.overwriteEdited !== true && (await this.fs.readFileHash(path)).value !== digest) {
        throw new Error(
          `${location.toolName} hook script '${relativePath}' was edited during reinstall; removal refused. ${OVERWRITE_EDITED_HINT}`
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
      if (isErrnoException(err) && err.code === "ENOENT") return null;
      throw err;
    }
  }
}

/** A copy of `dist` with every `hooks/` file dropped, from `files` and from `components.hooks`
 * alike: for a capability declaring `hooksDestination: "project"`, so none of its hooks are
 * written under the plugin's own directory, only through `materialize`. */
export function withoutHooks(dist: PluginDistribution): PluginDistribution {
  return new PluginDistribution({
    manifest: dist.manifest,
    format: dist.format,
    files: dist.files.filter((f) => f.relativePath.split("/")[0] !== "hooks"),
    components: { ...dist.components, hooks: [] },
  });
}
