import { ManifestUnavailableError } from "../../contract/installation.error.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";

/** The project's manifest, for a command that has nothing to do without one. A manifest that
 * cannot be read surfaces as the repository named it. */
export async function requireManifest(
  manifestRepo: Pick<ManifestRepository, "load">
): Promise<Manifest> {
  const manifest = await manifestRepo.load();
  if (manifest === null) throw new ManifestUnavailableError("manifest-missing");
  return manifest;
}
