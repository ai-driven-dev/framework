import { projectIntegrationOf } from "../../../../src/composition/contexts/installation.js";
import type { RegisteredCatalog } from "../../../../src/composition/contexts/tools.js";
import { DeleteTrackedProjectFiles } from "../../../../src/contexts/installation/application/removal/project/delete-tracked-project-files.use-case.js";
import { RemoveAiddTraces } from "../../../../src/contexts/installation/application/removal/project/remove-aidd-traces.use-case.js";
import { RemoveMachineLocalFiles } from "../../../../src/contexts/installation/application/removal/project/remove-machine-local-files.use-case.js";
import { RemoveProjectFiles } from "../../../../src/contexts/installation/application/removal/project/remove-project-files.use-case.js";
import type { UpdateGitignore } from "../../../../src/contexts/installation/application/update-gitignore.use-case.js";
import type { ManifestRepository } from "../../../../src/contexts/installation/ports/manifest-repository.js";
import type { FileReader } from "../../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../../src/shared/ports/file-writer.js";
import type { Logger } from "../../../../src/shared/ports/logger.js";

export interface RemoveProjectFilesParts {
  fs: FileReader & FileWriter;
  manifestRepo: ManifestRepository;
  logger: Logger;
  updateGitignore: UpdateGitignore;
  homedir: () => string;
  tools: RegisteredCatalog;
}

/** A project removal wired from the doubles of one project. */
export function removeProjectFilesOver(parts: RemoveProjectFilesParts): RemoveProjectFiles {
  const { fs, manifestRepo, logger, updateGitignore, homedir, tools } = parts;
  return new RemoveProjectFiles({
    manifestRepo,
    trackedFiles: new DeleteTrackedProjectFiles({ fs, logger, homedir }, tools),
    machineLocalFiles: new RemoveMachineLocalFiles(fs, tools, projectIntegrationOf(fs).removeHooks),
    aiddTraces: new RemoveAiddTraces({ fs, manifestRepo, logger, updateGitignore }, tools),
  });
}
