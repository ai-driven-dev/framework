import type { Manifest } from "../manifest.js";

export interface ManifestRepository {
  /** Where the manifest lives, so a diagnostic can name the file it failed to read rather than
   * report a failure a person cannot locate. */
  readonly path: string;
  load(): Promise<Manifest | null>;
  save(manifest: Manifest): Promise<void>;
  delete(): Promise<void>;
  /** Optional for project repositories; user-scope mutations hold an inter-process lock here. */
  withExclusiveAccess?<T>(action: () => Promise<T>): Promise<T>;
}
