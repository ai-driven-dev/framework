import type { BindingSnapshotStore } from "../../domain/ports/bindings/binding-snapshot-store.js";
import type { ConsentHistory } from "../../domain/ports/consent-history.js";
import type {
  ErasureEntry,
  MeasurementErasure,
} from "../../domain/ports/forget/measurement-erasure.js";
import type {
  RepositoryDeclarations,
  RepositoryKeys,
} from "../../domain/ports/forget/repository-declarations.js";
import type { ResolutionStore } from "../../domain/ports/resolution-store.js";
import type { UsageLedger } from "../../domain/ports/usage-ledger.js";

export interface ForgetPlan {
  readonly entries: readonly ErasureEntry[];
  /** Clones still on disk, named by their common git dir, with what their git config holds. */
  readonly repositories: readonly ({ readonly clone: string } & RepositoryKeys)[];
  /** Clones that are gone and had consented: they may have left a key nobody can reach. A gone
   * clone that never consented left nothing, and is not named. */
  readonly missing: readonly string[];
  /** Repositories that declared a task and whose location was never recorded. */
  readonly unlocated: number;
}

export type ForgetResult =
  | { readonly status: "preview"; readonly plan: ForgetPlan }
  | { readonly status: "forgotten"; readonly plan: ForgetPlan };

function nothingToForget(plan: ForgetPlan): boolean {
  return (
    plan.entries.length === 0 &&
    plan.repositories.every((repository) => repository.taskKeys === 0 && !repository.consent)
  );
}

/** Erases what measurement kept: previews by default, and removes only on confirmation. */
export class ForgetTelemetryUseCase {
  constructor(
    private readonly erasure: MeasurementErasure,
    private readonly declarations: RepositoryDeclarations,
    private readonly snapshots: BindingSnapshotStore,
    private readonly resolutions: ResolutionStore,
    private readonly history: ConsentHistory,
    private readonly ledger: UsageLedger
  ) {}

  async execute(confirmed: boolean): Promise<ForgetResult> {
    const plan = await this.plan();
    if (!confirmed) return { status: "preview", plan };
    if (nothingToForget(plan)) return { status: "forgotten", plan };
    // Held for the whole removal, so no ingest writes into what is being erased. What goes is
    // read again under the lock, and that is what is reported.
    return this.ledger.exclusively(async () => {
      const held = await this.plan();
      // The declarations first: they are found through the files that follow, so a crash
      // between the two leaves the way back to them.
      for (const repository of held.repositories) await this.declarations.clear(repository.clone);
      await this.erasure.erase();
      return { status: "forgotten" as const, plan: held };
    });
  }

  private async plan(): Promise<ForgetPlan> {
    const entries = await this.erasure.inventory();
    const found = await this.clonesRemembered();
    const repositories: ({ clone: string } & RepositoryKeys)[] = [];
    const missing: string[] = [];
    for (const clone of found.clones) {
      const keys = await this.declarations.count(clone);
      if (keys !== null) repositories.push({ clone, ...keys });
      else if (found.consenting.has(clone)) missing.push(clone);
    }
    return {
      entries,
      repositories,
      missing,
      unlocated: found.unlocated,
    };
  }

  /** The clones something was kept in: every one a directory was seen alive in, whatever
   * consent it found there (a clone that ran `off` still holds its key), and every one that
   * consented, whether or not any session ever ran there. A snapshot carries no path of its
   * own. */
  private async clonesRemembered(): Promise<{
    clones: string[];
    consenting: Set<string>;
    unlocated: number;
  }> {
    const remembered = [...(await this.resolutions.load()).values()];
    const consenting = new Set((await this.history.events()).map((event) => event.clone.path));
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
