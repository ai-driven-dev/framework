import { join } from "node:path";
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
import type { ProjectHooksProvenance } from "../../domain/plugins/plugin-entry.js";
import type { ProjectHooksSection } from "../../ports/tool-sections.js";
import {
  assertProjectHooksUnchanged,
  type ProjectHooksGuard,
} from "../shared/assert-project-hooks-unchanged.js";
import {
  recordedProjectHookEntries,
  removeRecordedProjectHooks,
} from "../shared/remove-project-hooks.js";

import {
  assertScriptsNotUserOwned,
  HOOKS_MANIFEST_PATH,
  type HooksDelivery,
  removeObsoleteScripts,
  writeProjectHookScripts,
} from "./project-hook-scripts.js";

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
      await this.detachPrevious({ dist, tool, projectRoot, previous, guard });
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
    await assertScriptsNotUserOwned(this.fs, delivery);
    const { warnings, entries } = await this.mergeProjectHooksJson(delivery, manifestFile);
    const scripts = await writeProjectHookScripts(this.fs, delivery);
    await removeObsoleteScripts(this.fs, delivery, scripts);
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

  private async detachPrevious(request: ProjectHooksMaterializerRequest): Promise<void> {
    const { dist, tool, projectRoot, previous, guard } = request;
    if (previous === undefined) return;
    await removeRecordedProjectHooks({
      fs: this.fs,
      pluginName: dist.manifest.name,
      provenance: previous,
      tool,
      projectRoot,
      guard,
    });
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
