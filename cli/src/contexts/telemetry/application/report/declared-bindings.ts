import type { AttributionFacts } from "../../domain/report/attribution.js";
import type { BindingSnapshotStore } from "../../ports/bindings/binding-snapshot-store.js";
import type { SessionBindingStore } from "../../ports/bindings/session-binding-store.js";
import type { PersonIdentityStore } from "../../ports/identity/person-identity-store.js";

/** Everything people declared about what their work belongs to, wherever each kind is kept:
 * session declarations, the carries across a `/clear`, the snapshots of branch declarations, and
 * who the person chose to be measured as. Read whole, never narrowed to a period. */
export class DeclaredBindings {
  constructor(
    private readonly sessions: SessionBindingStore,
    private readonly snapshots: BindingSnapshotStore,
    private readonly identity: PersonIdentityStore
  ) {}

  async read(): Promise<{ readonly facts: AttributionFacts; readonly person: string | null }> {
    const facts = {
      declarations: await this.sessions.declarations(),
      carries: await this.sessions.carries(),
      branches: await this.snapshots.history(),
    };
    return { facts, person: await this.identity.read() };
  }
}
