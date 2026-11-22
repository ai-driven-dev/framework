import type { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { ManifestRepository } from "../../../src/contexts/installation/ports/manifest-repository.js";
import type { RegistrationRecords } from "../../../src/contexts/installation/ports/record/registration-records.js";
import { InMemoryRepository } from "./in-memory-repository.fake.js";

export class InMemoryManifestRepository
  extends InMemoryRepository<Manifest>
  implements ManifestRepository
{
  /** Derived from the root the test drives the use case with, never a fixed literal: a
   * double naming a fictional file lets a diagnostic go wrong with every test still green. */
  readonly path: string;
  /** The records as last saved. A test seeds them here and reads them back here. */
  records: RegistrationRecords;
  /** Counted apart from `saveCount`: a test proving nothing was written asserts both. */
  recordSaveCount = 0;

  constructor(
    seed: Manifest | null = null,
    projectRoot = "/test-project",
    records: RegistrationRecords = new Map()
  ) {
    super(seed);
    this.path = `${projectRoot}/.aidd/manifest.json`;
    this.records = new Map(records);
  }

  async loadIfReadable(): Promise<Manifest | null> {
    return this.load().catch(() => null);
  }

  async loadRecords(): Promise<RegistrationRecords> {
    return new Map(this.records);
  }

  async saveRecords(records: RegistrationRecords): Promise<void> {
    this.recordSaveCount += 1;
    this.records = new Map(records);
  }

  async delete(): Promise<void> {
    this.record = null;
    this.records = new Map();
  }
}
