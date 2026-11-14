import type { AttributionFacts } from "../../domain/report/attribution.js";
import type { BindingSnapshotStore } from "../../ports/bindings/binding-snapshot-store.js";
import type { SessionBindingStore } from "../../ports/bindings/session-binding-store.js";

/** Everything people declared about what their work belongs to, wherever each kind is kept:
 * session declarations, the carries across a `/clear`, and the snapshots of branch
 * declarations. Read whole, never narrowed to a period. */
export class DeclaredBindings {
  constructor(
    private readonly sessions: SessionBindingStore,
    private readonly snapshots: BindingSnapshotStore
  ) {}

  async read(): Promise<AttributionFacts> {
    return {
      declarations: await this.sessions.declarations(),
      carries: await this.sessions.carries(),
      branches: await this.snapshots.history(),
    };
  }
}
