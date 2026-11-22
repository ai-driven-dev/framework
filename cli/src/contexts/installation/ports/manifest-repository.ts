import type { Manifest } from "../domain/manifest.js";
import type { RegistrationRecords } from "./record/registration-records.js";

export interface ManifestRepository {
  /** Where the manifest lives, so a diagnostic can name the file it failed to read rather than
   * report a failure a person cannot locate. */
  readonly path: string;
  load(): Promise<Manifest | null>;
  /** `load`, with any failure to read or parse answered as none, for a best-effort caller that
   * treats an unreadable manifest as absent. */
  loadIfReadable(): Promise<Manifest | null>;
  save(manifest: Manifest): Promise<void>;
  /** Removes the manifest and the records kept beside it. */
  delete(): Promise<void>;
  /** The records kept beside the manifest: what each tool's host registration holds. */
  loadRecords(): Promise<RegistrationRecords>;
  saveRecords(records: RegistrationRecords): Promise<void>;
}
