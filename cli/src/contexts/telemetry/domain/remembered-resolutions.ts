import type { CloneIdentity } from "./consent/clone-identity.js";
import {
  type RepositoryResolution,
  resolutionKey,
  sameResolution,
} from "./repository-resolution.js";

/** A directory found alive in a clone, and when it was found. */
export interface Sighting {
  readonly dir: string;
  readonly repositoryId: string;
  readonly root: string;
  readonly clone: CloneIdentity;
  /** ISO-8601 UTC. */
  readonly at: string;
}

/** The sightings of a directory in a clone that a run holds. `changed` says whether any is new
 * or differs from what was loaded, so that only a run that learned something writes back. */
export class RememberedResolutions {
  constructor(
    readonly sightings: ReadonlyMap<string, RepositoryResolution>,
    readonly changed = false
  ) {}

  /** Keeps the first sighting of a directory in a clone, and what it was found to be since:
   * `seen` is the sighting as kept, `remembered` the sightings with it. */
  remember(sighting: Sighting): {
    readonly seen: RepositoryResolution;
    readonly remembered: RememberedResolutions;
  } {
    const key = resolutionKey(sighting.dir, sighting.clone);
    const held = this.sightings.get(key);
    const seen = {
      dir: sighting.dir,
      repository_id: sighting.repositoryId,
      root: sighting.root,
      clone: sighting.clone,
      seen_at: held?.seen_at ?? sighting.at,
    };
    if (sameResolution(held, seen)) return { seen, remembered: this };
    return {
      seen,
      remembered: new RememberedResolutions(new Map(this.sightings).set(key, seen), true),
    };
  }

  ownersOf(dir: string): RepositoryResolution[] {
    return [...this.sightings.values()].filter((resolution) => resolution.dir === dir);
  }
}
