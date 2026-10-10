import type { BindingSnapshotStore } from "../../domain/ports/bindings/binding-snapshot-store.js";
import type {
  ErasureEntry,
  MeasurementErasure,
} from "../../domain/ports/forget/measurement-erasure.js";
import type {
  RepositoryDeclarations,
  RepositoryKeys,
} from "../../domain/ports/forget/repository-declarations.js";
import type { RepositoryLocator } from "../../domain/ports/repository-locator.js";
import type { ResolutionStore } from "../../domain/ports/resolution-store.js";
import type { UsageLedger } from "../../domain/ports/usage-ledger.js";
import { repositoryIdOf } from "../../domain/repository-identity.js";

export interface ForgetPlan {
  readonly entries: readonly ErasureEntry[];
  /** Clones still on disk, named by their common git dir, with what their git config holds. */
  readonly repositories: readonly ({ readonly clone: string } & RepositoryKeys)[];
  /** Clones that are gone, and roots remembered before clones were recorded that are gone or
   * no longer that repository. */
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
    private readonly locator: RepositoryLocator,
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
    const missing = [...found.missing];
    for (const clone of found.clones) {
      const keys = await this.declarations.count(clone);
      if (keys === null) missing.push(clone);
      else repositories.push({ clone, ...keys });
    }
    return {
      entries,
      repositories,
      missing: missing.sort(),
      unlocated: found.unlocated,
    };
  }

  /** The clones something was kept in. Every directory ingest or `on` remembered names its
   * clone, whatever consent it found there: a clone that ran `off` still holds its key. A
   * directory remembered before clones were recorded is located again, by the repository it was
   * declared or consented in. A snapshot carries no path of its own. */
  private async clonesRemembered(): Promise<{
    clones: string[];
    missing: string[];
    unlocated: number;
  }> {
    const remembered = [...(await this.resolutions.load()).values()];
    const clones = new Set<string>();
    const idsWithClone = new Set<string>();
    for (const resolution of remembered) {
      if (resolution.clone === undefined) continue;
      clones.add(resolution.clone);
      idsWithClone.add(resolution.repository_id);
    }
    const ids = new Set([...(await this.snapshots.latest()).values()].map((s) => s.repository_id));
    for (const resolution of remembered) {
      if (resolution.consented) ids.add(resolution.repository_id);
    }
    const legacy = new Map<string, Set<string>>();
    for (const resolution of remembered) {
      if (resolution.clone !== undefined || !ids.has(resolution.repository_id)) continue;
      const roots = legacy.get(resolution.repository_id) ?? new Set<string>();
      roots.add(resolution.root);
      legacy.set(resolution.repository_id, roots);
    }
    const missing: string[] = [];
    for (const [id, roots] of legacy) {
      let alive = 0;
      for (const root of roots) {
        const located = await this.locator.locate(root);
        if (located.status === "repository" && repositoryIdOf(located) === id) {
          clones.add(located.clone);
          alive += 1;
        }
      }
      if (alive === 0 && !idsWithClone.has(id)) missing.push(...roots);
    }
    const located = new Set([...idsWithClone, ...legacy.keys()]);
    return {
      clones: [...clones].sort(),
      missing,
      unlocated: [...ids].filter((id) => !located.has(id)).length,
    };
  }
}
