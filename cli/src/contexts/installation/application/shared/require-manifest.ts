import { ManifestUnavailableError } from "../../../../shared/domain/errors.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";

/** The project's manifest, for a command that has nothing to do without one. A manifest that
 * cannot be read surfaces as the repository raised it.
 *
 * Limit: `manifest-corrupted` is produced by `LoadManifest` (doctor) alone; here only
 * `manifest-missing` is named, and an unreadable file, EACCES included, is the raw error. */
export async function requireManifest(manifestRepo: ManifestRepository): Promise<Manifest> {
  const manifest = await manifestRepo.load();
  if (manifest === null) throw new ManifestUnavailableError("manifest-missing");
  return manifest;
}
