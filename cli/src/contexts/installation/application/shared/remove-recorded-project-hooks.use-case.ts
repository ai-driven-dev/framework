import { dirname, join } from "node:path";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { ProjectHooksProvenance } from "../../domain/plugins/plugin-entry.js";
import { recordedHooksLocation } from "../../domain/project-hooks.model.js";
import type { AssertProjectPathWithinRoot } from "../ownership/assert-project-path-within-root.use-case.js";
import type {
  AssertProjectHooksUnchanged,
  RecordedProjectHooks,
} from "./assert-project-hooks-unchanged.use-case.js";

/** What RemoveRecordedProjectHooks is built from. */
export interface RemoveRecordedProjectHooksDeps {
  readonly fs: FileReader & FileWriter;
  readonly unchanged: Pick<AssertProjectHooksUnchanged, "execute">;
  readonly withinRoot: Pick<AssertProjectPathWithinRoot, "execute">;
}

/** Unmerge only verified hook entries and tracked scripts; never delete a directory by name. */
export class RemoveRecordedProjectHooks {
  constructor(private readonly deps: RemoveRecordedProjectHooksDeps) {}

  async execute(request: RecordedProjectHooks): Promise<boolean> {
    const { fs, unchanged, withinRoot } = this.deps;
    const { pluginName, provenance, tool, projectRoot } = request;
    const delivery = recordedHooksLocation(tool);
    if (delivery === null) return false;
    const { format } = delivery;
    const { existing } = await unchanged.execute(request);
    const hooksPath = join(projectRoot, delivery.relativePath);
    const hasEntries =
      existing !== null && format.contributedEntries(existing, pluginName).length > 0;
    if (hasEntries && existing !== null) {
      await withinRoot.execute(projectRoot, hooksPath);
      const unmerged = format.unmerge(existing, pluginName);
      if (format.isEmpty(unmerged)) await fs.deleteFile(hooksPath);
      else await fs.writeFile(hooksPath, unmerged);
    }
    const removedScript = await this.removeRecordedScripts(projectRoot, provenance);
    return hasEntries || removedScript;
  }

  private async removeRecordedScripts(
    projectRoot: string,
    provenance: ProjectHooksProvenance | undefined
  ): Promise<boolean> {
    const { fs, withinRoot } = this.deps;
    let removed = false;
    for (const relativePath of provenance?.scripts.keys() ?? []) {
      const path = join(projectRoot, relativePath);
      if (!(await fs.fileExists(path))) continue;
      await withinRoot.execute(projectRoot, path);
      await fs.deleteFile(path);
      await fs.deleteEmptyDirectories(dirname(path));
      removed = true;
    }
    return removed;
  }
}
