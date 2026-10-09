import type { RepositoryResolution } from "../repository-resolution.js";

/** The repository each working directory was found to be, kept for the directories that
 * are gone by the time their lines are read. */
export interface ResolutionStore {
  load(): Promise<Map<string, RepositoryResolution>>;
  save(resolutions: ReadonlyMap<string, RepositoryResolution>): Promise<void>;
}
