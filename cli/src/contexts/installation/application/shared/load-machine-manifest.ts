import { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";

/** The machine's manifest, empty when nothing is claimed yet. */
export async function loadMachineManifest(
  repo: Pick<ManifestRepository, "load">
): Promise<Manifest> {
  return (await repo.load()) ?? Manifest.create();
}
