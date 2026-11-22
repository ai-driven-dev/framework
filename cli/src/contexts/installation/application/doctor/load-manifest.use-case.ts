import { ManifestUnavailableError } from "../../domain/installation.error.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type {
  RecordsBesideManifest,
  RegistrationRecords,
} from "../../ports/record/registration-records.js";
import { requireManifest } from "../shared/require-manifest.js";

/** Reads the installation's manifest for a doctor check, naming what is wrong when it cannot.
 *
 * Limit: `manifest-corrupted` is produced here alone. Every other site surfaces the repository's
 * raw error, and any failure to read, EACCES included, is reported as invalid JSON. */
export class LoadManifest {
  constructor(private readonly manifestRepo: ManifestRepository & RecordsBesideManifest) {}

  async execute(): Promise<Manifest> {
    try {
      return await requireManifest(this.manifestRepo);
    } catch (error) {
      if (error instanceof ManifestUnavailableError) throw error;
      throw new ManifestUnavailableError("manifest-corrupted", { cause: error });
    }
  }

  /** The records kept beside the manifest. */
  records(): Promise<RegistrationRecords> {
    return this.manifestRepo.loadRecords();
  }
}
