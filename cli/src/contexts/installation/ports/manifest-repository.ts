import type { Manifest } from "../domain/manifest.js";

export interface ManifestRepository {
  /** Where the manifest lives, so a diagnostic can name the file it failed to read rather than
   * report a failure a person cannot locate. */
  readonly path: string;
  /** Null when there is no manifest. A manifest that cannot be had is refused by name:
   * `ManifestUnavailableError` (`manifest-corrupted`) for invalid JSON or an invalid shape,
   * `ManifestUnreadableError` for a file the system refuses to read, and the version error for a
   * version this CLI does not read. */
  load(): Promise<Manifest | null>;
  /** `load`, with any failure to read or parse answered as none, for a best-effort caller that
   * treats an unreadable manifest as absent. */
  loadIfReadable(): Promise<Manifest | null>;
  save(manifest: Manifest): Promise<void>;
  /** Removes the manifest and the records kept beside it. */
  delete(): Promise<void>;
}
