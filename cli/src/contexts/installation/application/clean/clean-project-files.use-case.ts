import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import type { ProjectPluginIntegration } from "../../ports/tool-sections.js";
import type { RemoveProjectFiles } from "../removal/project/remove-project-files.js";
import type { AssertProjectRemovable } from "./assert-project-removable.use-case.js";
import type { PlanProjectClean } from "./plan-project-clean.use-case.js";
import type { ProjectCleanPlan, ProjectCleanRecords } from "./project-clean-plan.js";

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
  readonly assertProjectRemovable: AssertProjectRemovable;
  readonly removeProjectFiles: RemoveProjectFiles;
  readonly planProjectClean: PlanProjectClean;
}

/**
 * The project-local half of `aidd clean`: reads what this project installed, proves each part
 * removable, then deletes the files, the merged keys and AIDD's own state. Undoing the host's
 * registration and releasing the machine claims sit around those and are the caller's.
 */
export class CleanProjectFiles {
  constructor(private readonly deps: CleanProjectFilesDeps) {}

  /** `plan` answers `null` when this project installed nothing. `assert-removable` refuses while a
   * hook or an MCP entry of a tracked plugin could not be removed cleanly. `remove` answers how
   * many files it deleted. */
  async execute(command: CleanProjectFilesRequest): Promise<ProjectCleanPlan | null>;
  async execute(command: AssertProjectRemovableRequest): Promise<void>;
  async execute(command: RemoveProjectFilesRequest): Promise<number>;
  async execute(command: AnyCleanProjectFilesRequest): Promise<unknown> {
    switch (command.kind) {
      case "plan":
        return this.deps.planProjectClean.execute(command.records);
      case "assert-removable":
        return this.deps.assertProjectRemovable.execute(command);
      case "remove":
        return this.deps.removeProjectFiles.remove(command.projectRoot, command.force);
    }
  }
}
