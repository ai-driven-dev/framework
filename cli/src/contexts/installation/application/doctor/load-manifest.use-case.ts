import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import { requireManifest } from "../shared/require-manifest.js";

/** Reads the installation's manifest for a doctor check. A manifest that cannot be had surfaces
 * as `requireManifest` names it. */
export class LoadManifest {
  constructor(private readonly manifestRepo: Pick<ManifestRepository, "load">) {}

  execute(): Promise<Manifest> {
    return requireManifest(this.manifestRepo);
  }
}
