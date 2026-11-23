import { ManifestUnavailableError } from "../../domain/installation.error.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";

/** Reads the installation's manifest for a doctor check, naming what is wrong when it cannot.
 *
 * Limit: `manifest-corrupted` is produced on this path alone. Every other site surfaces the
 * repository's raw error. */
export class LoadManifest {
  constructor(private readonly manifestRepo: Pick<ManifestRepository, "loadForDiagnosis">) {}

  async execute(): Promise<Manifest> {
    const manifest = await this.manifestRepo.loadForDiagnosis();
    if (manifest === null) throw new ManifestUnavailableError("manifest-missing");
    return manifest;
  }
}
