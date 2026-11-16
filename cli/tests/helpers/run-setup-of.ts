import { InitProject } from "../../src/contexts/installation/application/init-project.js";
import type { ManifestRepository } from "../../src/contexts/installation/ports/manifest-repository.js";
import {
  RunSetup,
  type SetupQuestions,
  type SetupSteps,
} from "../../src/orchestration/setup/run-setup.js";
import type { FileReader } from "../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../src/shared/ports/file-writer.js";

/** The setup scenario as composition wires it: the steps and the questions as two bundles, the
 * manifest initialization as a third. */
export function runSetupOf(
  fs: FileReader & FileWriter,
  manifestRepo: ManifestRepository,
  steps: SetupSteps,
  questions: SetupQuestions
): RunSetup {
  return new RunSetup(steps, questions, new InitProject(fs, manifestRepo));
}
