import { join } from "node:path";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type {
  PluginTranslationSkip,
  ReadonlySkipList,
} from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import { isErrnoException } from "../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { ProjectHooksProvenance } from "../../domain/plugins/plugin-entry.js";
import type { PluginTranslationResult } from "../../ports/plugin/plugin-translation.js";
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
  type HooksDelivery,
  removeObsoleteScripts,
  writeProjectHookScripts,
} from "./project-hook-scripts.js";

export interface ProjectHooksMaterializerRequest {
  readonly dist: PluginDistribution;
  /** What the translation made of the plugin's hooks for this tool. */
  readonly hooks: PluginTranslationResult["projectHooks"];
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
    hooks,
    tool,
    projectRoot,
    previous,
    guard = {},
  }: ProjectHooksMaterializerRequest): Promise<ProjectHooksMaterialized> {
    const location = tool.projectHooksDelivery();
    if (location === null) return { skipped: [] };
    if (hooks.manifest === null) {
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
    const delivery: HooksDelivery = {
      scripts: hooks.scripts,
      projectRoot,
      location,
      previous,
      guard,
    };
    await assertScriptsNotUserOwned(this.fs, delivery);
    const { warnings, entries } = await this.mergeProjectHooksJson(delivery, {
      pluginName: dist.manifest.name,
      manifest: hooks.manifest,
    });
    const scripts = await writeProjectHookScripts(this.fs, delivery);
    await removeObsoleteScripts(this.fs, delivery, scripts);
    return {
      skipped: warnings.map((reason) => skipOf(dist.manifest.name, tool, reason)),
      projectHooks: { entries, scripts },
    };
  }

  private async detachPrevious(
    request: Omit<ProjectHooksMaterializerRequest, "hooks">
  ): Promise<void> {
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
    { projectRoot, location }: HooksDelivery,
    plugin: { pluginName: string; manifest: string }
  ): Promise<{ warnings: readonly string[]; entries: ProjectHooksProvenance["entries"] }> {
    const destPath = join(projectRoot, location.relativePath);
    const existing = await this.readExistingJson(destPath);
    const { content, warnings } = location.format.merge(
      existing,
      plugin.manifest,
      plugin.pluginName
    );
    await this.fs.writeFile(destPath, content);
    return {
      warnings,
      entries: recordedProjectHookEntries(location.format, content, plugin.pluginName),
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

function skipOf(
  pluginName: string,
  tool: ProjectHooksSection,
  reason: string
): PluginTranslationSkip {
  return {
    pluginName,
    component: "hooks",
    toolId: tool.toolId,
    reason: `${tool.toolId}: ${reason}`,
  };
}
