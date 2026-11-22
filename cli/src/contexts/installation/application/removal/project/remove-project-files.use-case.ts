import type { ManifestRepository } from "../../../ports/manifest-repository.js";
import type { DeleteTrackedProjectFiles } from "./delete-tracked-project-files.use-case.js";
import type { RemoveAiddTraces } from "./remove-aidd-traces.use-case.js";
import type { RemoveMachineLocalFiles } from "./remove-machine-local-files.use-case.js";

/** What RemoveProjectFiles is built from. */
export interface RemoveProjectFilesDeps {
  readonly manifestRepo: ManifestRepository;
  readonly trackedFiles: DeleteTrackedProjectFiles;
  readonly machineLocalFiles: RemoveMachineLocalFiles;
  readonly aiddTraces: RemoveAiddTraces;
}

/**
 * What `aidd clean` deletes from a project: the files each tool installed, the merged keys, the
 * machine-local settings, then AIDD's own traces.
 */
export class RemoveProjectFiles {
  constructor(private readonly deps: RemoveProjectFilesDeps) {}

  /** Deletes what this project installed and returns how many files that was. */
  async execute(projectRoot: string, force: boolean): Promise<number> {
    const { manifestRepo, trackedFiles, machineLocalFiles, aiddTraces } = this.deps;
    const manifest = await manifestRepo.load();
    if (manifest === null) return 0;
    let deleted = await trackedFiles.execute(manifest, projectRoot);
    deleted += await machineLocalFiles.execute(manifest, projectRoot, { overwriteEdited: force });
    await aiddTraces.execute(manifest, projectRoot);
    return deleted;
  }
}
