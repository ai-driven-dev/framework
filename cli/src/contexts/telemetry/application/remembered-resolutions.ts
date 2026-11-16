import type { CloneIdentity } from "../domain/consent/clone-identity.js";
import {
  type RepositoryResolution,
  resolutionKey,
  sameResolution,
} from "../domain/repository-resolution.js";
import type { ResolutionStore } from "../ports/resolution-store.js";

/** The sightings of a directory in a clone that a run holds, with the store they came from
 * and go back to. Kept apart from the run so that what is remembered, and whether it changed,
 * is answered in one place. */
export class RememberedResolutions {
  private changed = false;

  private constructor(
    private readonly store: ResolutionStore,
    private readonly sightings: Map<string, RepositoryResolution>
  ) {}

  static async load(store: ResolutionStore): Promise<RememberedResolutions> {
    return new RememberedResolutions(store, await store.load());
  }

  /** Keeps the first sighting of a directory in a clone, and what it was found to be since. */
  remember(
    dir: string,
    repositoryId: string,
    root: string,
    clone: CloneIdentity,
    now: () => Date
  ): RepositoryResolution {
    const key = resolutionKey(dir, clone);
    const held = this.sightings.get(key);
    const seen = {
      dir,
      repository_id: repositoryId,
      root,
      clone,
      seen_at: held?.seen_at ?? now().toISOString(),
    };
    if (sameResolution(held, seen)) return seen;
    this.sightings.set(key, seen);
    this.changed = true;
    return seen;
  }

  ownersOf(dir: string): RepositoryResolution[] {
    return [...this.sightings.values()].filter((resolution) => resolution.dir === dir);
  }

  /** Keeps what this run learned. */
  async save(): Promise<void> {
    if (this.changed) await this.store.save(this.sightings);
  }
}
