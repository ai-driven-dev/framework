import type { RepositoryResolution } from "../../../../src/contexts/telemetry/domain/repository-resolution.js";
import type { ResolutionStore } from "../../../../src/contexts/telemetry/ports/resolution-store.js";

export class InMemoryResolutions implements ResolutionStore {
  resolutions = new Map<string, RepositoryResolution>();
  saves = 0;

  async load(): Promise<Map<string, RepositoryResolution>> {
    return new Map(this.resolutions);
  }

  async save(resolutions: ReadonlyMap<string, RepositoryResolution>): Promise<void> {
    this.saves += 1;
    this.resolutions = new Map(resolutions);
  }
}
