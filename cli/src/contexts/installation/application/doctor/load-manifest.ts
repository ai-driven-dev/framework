import { ManifestValidationError, NoManifestError } from "../../../../shared/domain/errors.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";

/** Reads the installation's manifest for a doctor check, naming what is wrong when it cannot. */
export class LoadManifest {
  constructor(private readonly manifestRepo: ManifestRepository) {}

  async execute(): Promise<Manifest> {
    let manifest: Manifest | null;
    try {
      manifest = await this.manifestRepo.load();
    } catch {
      throw new ManifestValidationError(
        "Manifest is corrupted (invalid JSON). Run `aidd clean --force` and re-initialize."
      );
    }
    if (manifest === null) throw new NoManifestError();
    return manifest;
  }
}
