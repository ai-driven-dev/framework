import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { RecordedPlugin } from "../domain/plugins/recorded-plugin.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import type { ProjectPluginIntegration } from "../ports/tool-sections.js";
import {
  PlanProjectClean,
  type ProjectCleanPlan,
  type ProjectCleanRecords,
} from "./plan-project-clean.use-case.js";
import type { RemoveProjectFiles } from "./removal/remove-project-files.js";
import { assertProjectHooksRemovable } from "./shared/remove-project-hooks.js";

/** What a project clean asks of the machine, answered where each one lives. */
export interface ProjectCleanAsks {
  /** The one resolver for the OS home directory a clean ever calls. */
  readonly homeDir: () => string;
  /** Read-only proof that a plugin's MCP entries can be removed from the project. */
  readonly assertMcpRemovable: (
    plugin: RecordedPlugin,
    tool: ProjectPluginIntegration,
    projectRoot: string
  ) => Promise<void>;
}

export interface CleanProjectFilesRequest {
  kind: "plan";
  /** What the host registration says of the registrations this project recorded. */
  records: ProjectCleanRecords;
}

export interface AssertProjectRemovableRequest {
  kind: "assert-removable";
  projectRoot: string;
  force: boolean;
}

export interface RemoveProjectFilesRequest {
  kind: "remove";
  projectRoot: string;
  force: boolean;
}

export type AnyCleanProjectFilesRequest =
  | CleanProjectFilesRequest
  | AssertProjectRemovableRequest
  | RemoveProjectFilesRequest;

/** What CleanProjectFiles is built from. */
export interface CleanProjectFilesDeps {
  readonly fs: FileReader;
  readonly manifestRepo: ManifestRepository;
  readonly asks: ProjectCleanAsks;
  readonly removeProjectFiles: RemoveProjectFiles;
}

/**
 * The project-local half of `aidd clean`: reads what this project installed, proves each part
 * removable, then deletes the files, the merged keys and AIDD's own state. Undoing the host's
 * registration and releasing the machine claims sit around those and are the caller's.
 */
export class CleanProjectFiles {
  private readonly planProjectClean: PlanProjectClean;

  constructor(
    private readonly deps: CleanProjectFilesDeps,
    private readonly tools: ToolCatalog
  ) {
    this.planProjectClean = new PlanProjectClean(deps, tools);
  }

  /** `plan` answers `null` when this project installed nothing. `assert-removable` refuses while a
   * hook or an MCP entry of a tracked plugin could not be removed cleanly. `remove` answers how
   * many files it deleted. */
  async execute(command: CleanProjectFilesRequest): Promise<ProjectCleanPlan | null>;
  async execute(command: AssertProjectRemovableRequest): Promise<void>;
  async execute(command: RemoveProjectFilesRequest): Promise<number>;
  async execute(command: AnyCleanProjectFilesRequest): Promise<unknown> {
    switch (command.kind) {
      case "plan":
        return this.planProjectClean.execute(command.records);
      case "assert-removable":
        return this.assertRemovable(command.projectRoot, command.force);
      case "remove":
        return this.deps.removeProjectFiles.remove(command.projectRoot, command.force);
    }
  }

  private async assertRemovable(projectRoot: string, force: boolean): Promise<void> {
    const manifest = await this.deps.manifestRepo.load();
    if (manifest === null) return;
    for (const toolId of manifest.getInstalledToolIds()) {
      if (!this.tools.isAiTool(toolId)) continue;
      for (const plugin of manifest.getRecordedPlugins(toolId)) {
        const tool = this.tools.aiProfile(toolId);
        await assertProjectHooksRemovable({
          fs: this.deps.fs,
          plugin,
          tool,
          projectRoot,
          guard: {
            overwriteEdited: force,
          },
        });
        await this.deps.asks.assertMcpRemovable(plugin, tool, projectRoot);
      }
    }
  }
}
