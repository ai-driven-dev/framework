import type { BindingSnapshotStore } from "../../ports/bindings/binding-snapshot-store.js";
import type { ConsentHistory } from "../../ports/consent-history.js";
import type { ResolutionStore } from "../../ports/resolution-store.js";

/** The clones something was kept in, and what could not be tied back to one. */
export interface Remembered {
  readonly clones: readonly string[];
  /** The clones that ever consented, whether or not they are still on disk. */
  readonly consenting: ReadonlySet<string>;
  /** Repositories that declared a task and whose location was never recorded. */
  readonly unlocated: number;
}

/** The clones something was kept in: every one a directory was seen alive in, whatever
 * consent it found there (a clone that ran `off` still holds its key), and every one that
 * consented, whether or not any session ever ran there. A snapshot carries no path of its
 * own. */
export class RememberedClones {
  constructor(
    private readonly resolutions: ResolutionStore,
    private readonly history: ConsentHistory,
    private readonly snapshots: BindingSnapshotStore
  ) {}

  async read(): Promise<Remembered> {
    const remembered = [...(await this.resolutions.load()).values()];
    const consenting = new Set(
      (await this.history.read()).events.flatMap((event) =>
        event.kind === "open" ? [event.clone.path] : []
      )
    );
    const clones = new Set([...remembered.map((r) => r.clone.path), ...consenting]);
    const located = new Set(remembered.map((resolution) => resolution.repository_id));
    const ids = new Set([...(await this.snapshots.latest()).values()].map((s) => s.repository_id));
    return {
      clones: [...clones].sort(),
      consenting,
      unlocated: [...ids].filter((id) => !located.has(id)).length,
    };
  }
}
