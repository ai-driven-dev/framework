import type { LocatedDirectory } from "../domain/resolution/located-directory.js";

export interface RepositoryLocator {
  /** What a working directory is, as it stands now. */
  locate(cwd: string): Promise<LocatedDirectory>;
}
