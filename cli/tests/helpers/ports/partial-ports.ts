import type { Manifest } from "../../../src/contexts/framework/domain/manifest.js";
import type { ManifestRepository } from "../../../src/contexts/framework/domain/ports/manifest-repository.js";
import type { Prompter } from "../../../src/kernel/ports/prompter.js";

function refuse(what: string): () => never {
  return () => {
    throw new Error(`${what} was not expected by this test`);
  };
}

/** A full `Prompter` that answers the questions a test scripts and fails on any other, so a
 * command that starts asking something new turns the test red instead of hanging on a stub. */
export function prompterAnswering(answers: Partial<Prompter>): Prompter {
  return {
    resolveConflict: refuse("prompter.resolveConflict"),
    resolveConflictBulk: refuse("prompter.resolveConflictBulk"),
    confirm: refuse("prompter.confirm"),
    input: refuse("prompter.input"),
    select: refuse("prompter.select"),
    checkbox: refuse("prompter.checkbox"),
    ...answers,
  };
}

/** A full `ManifestRepository` that serves `load` and fails on a write the test did not expect. */
export function manifestRepositoryLoading(
  load: () => Promise<Manifest | null>
): ManifestRepository {
  return {
    path: "manifest.json",
    load,
    save: refuse("manifestRepo.save"),
    delete: refuse("manifestRepo.delete"),
  };
}
