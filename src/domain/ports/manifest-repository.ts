import type { Manifest } from "../models/manifest.js";

export interface ManifestRepository {
  load(): Promise<Manifest | null>;
  save(manifest: Manifest): Promise<void>;
  delete(): Promise<void>;
}
