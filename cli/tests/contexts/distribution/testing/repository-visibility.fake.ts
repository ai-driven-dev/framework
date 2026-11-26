import type { RepositoryVisibility } from "../../../../src/contexts/distribution/ports/repository-visibility.js";
import { HIDDEN_REPO } from "./repository-visibility.contract.js";

/** A forge held in memory: only the hidden repository is not public. */
export class InMemoryRepositoryVisibility implements RepositoryVisibility {
  async isRepoPublic(repo: string): Promise<boolean> {
    return repo !== HIDDEN_REPO;
  }
}
