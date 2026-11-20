import type { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import type { ManifestRepository } from "../../../../src/contexts/installation/ports/manifest-repository.js";
import { InMemoryRepository } from "../../../shared/testing/in-memory-repository.fake.js";

export class InMemoryManifestRepository
  extends InMemoryRepository<Manifest>
  implements ManifestRepository
{
  /** Derived from the root the test drives the use case with, never a fixed literal: a
   * double naming a fictional file lets a diagnostic go wrong with every test still green. */
  readonly path: string;

  constructor(seed: Manifest | null = null, projectRoot = "/test-project") {
    super(seed);
    this.path = `${projectRoot}/.aidd/manifest.json`;
  }

  async delete(): Promise<void> {
    this.record = null;
  }
}
