import { InitProject } from "../../../src/contexts/installation/application/init-project.use-case.js";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.use-case.js";
import type { ManifestRepository } from "../../../src/contexts/installation/ports/manifest-repository.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import {
  RunSetup,
  type SetupQuestions,
  type SetupSteps,
} from "../../../src/orchestration/setup/run-setup.use-case.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../src/shared/ports/file-writer.js";

/** The setup scenario as composition wires it: the steps and the questions as two bundles, the
 * manifest initialization as a third. */
export function runSetupOf(parts: {
  tools: ToolCatalog;
  fs: FileReader & FileWriter;
  manifestRepo: ManifestRepository;
  steps: SetupSteps;
  questions: SetupQuestions;
}): RunSetup {
  const { tools, fs, manifestRepo, steps, questions } = parts;
  return new RunSetup(
    steps,
    questions,
    new InitProject({ fs, manifestRepo, updateGitignore: new UpdateGitignore(fs) }, tools)
  );
}
