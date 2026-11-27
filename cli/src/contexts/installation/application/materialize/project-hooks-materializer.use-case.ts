import { join } from "node:path";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import {
  hooksSkip,
  type ReadonlySkipList,
  toolWarning,
} from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import { whenAbsent } from "../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { ProjectHooksProvenance } from "../../domain/plugins/plugin-entry.js";
import { recordedProjectHookEntries } from "../../domain/project-hooks.model.js";
import type { PluginTranslationResult } from "../../ports/plugin/plugin-translation.js";
import type { ProjectHooksSection } from "../../ports/tool-sections.js";
import type {
  AssertProjectHooksUnchanged,
  ProjectHooksGuard,
} from "../shared/assert-project-hooks-unchanged.use-case.js";
import type { RemoveRecordedProjectHooks } from "../shared/remove-recorded-project-hooks.use-case.js";

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

export interface ProjectHooksMaterializerResult {
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
  constructor(
    private readonly fs: FileWriter & FileReader,
    private readonly unchanged: Pick<AssertProjectHooksUnchanged, "execute">,
    private readonly removeRecorded: Pick<RemoveRecordedProjectHooks, "execute">
  ) {}

  async execute({
    dist,
    hooks,
    tool,
    projectRoot,
    previous,
    guard = {},
  }: ProjectHooksMaterializerRequest): Promise<ProjectHooksMaterializerResult> {
    const location = tool.projectHooksDelivery();
    if (location === null) {
      await this.detachPrevious({ dist, tool, projectRoot, previous, guard });
      return { skipped: [] };
    }
    if (hooks.manifest === null) {
      await this.detachPrevious({ dist, tool, projectRoot, previous, guard });
      return { skipped: [] };
    }
    await this.unchanged.execute({
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
      skipped: warnings.map((reason) =>
        hooksSkip(dist.manifest.name, tool.toolId, toolWarning(tool.toolId, reason))
      ),
      projectHooks: { entries, scripts },
    };
  }

  private async detachPrevious(
    request: Omit<ProjectHooksMaterializerRequest, "hooks">
  ): Promise<void> {
    const { dist, tool, projectRoot, previous, guard } = request;
    if (previous === undefined) return;
    await this.removeRecorded.execute({
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
    return whenAbsent(() => this.fs.readFile(path), null);
  }
}
