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
  /** Repositories still on disk, with what their git config holds. */
  readonly repositories: readonly ({ readonly root: string } & RepositoryKeys)[];
  /** Roots the declarations were made in that are gone, or no longer that repository. */
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
      for (const repository of held.repositories) await this.declarations.clear(repository.root);
      await this.erasure.erase();
      return { status: "forgotten" as const, plan: held };
    });
  }

  private async plan(): Promise<ForgetPlan> {
    const entries = await this.erasure.inventory();
    const found = await this.repositoriesDeclaredIn();
    const repositories: ({ root: string } & RepositoryKeys)[] = [];
    for (const root of found.live) {
      repositories.push({ root, ...(await this.declarations.count(root)) });
    }
    return {
      entries,
      repositories,
      missing: found.missing,
      unlocated: found.unlocated,
    };
  }

  /** The repositories something was kept in: a declaration was made there (the snapshots), or
   * ingest read it with its consent granted. Where each lives comes from what ingest
   * remembered; a snapshot carries no path of its own. */
  private async repositoriesDeclaredIn(): Promise<{
    live: string[];
    missing: string[];
    unlocated: number;
  }> {
    const ids = new Set([...(await this.snapshots.latest()).values()].map((s) => s.repository_id));
    const remembered = [...(await this.resolutions.load()).values()];
    for (const resolution of remembered) {
      if (resolution.consented) ids.add(resolution.repository_id);
    }
    const rootsOf = new Map<string, Set<string>>();
    for (const resolution of remembered) {
      if (!ids.has(resolution.repository_id)) continue;
      const roots = rootsOf.get(resolution.repository_id) ?? new Set<string>();
      roots.add(resolution.root);
      rootsOf.set(resolution.repository_id, roots);
    }
    // A linked worktree and its main one share a git config: one entry each repository.
    const live = new Set<string>();
    const missing: string[] = [];
    for (const [id, roots] of rootsOf) {
      const alive = new Set<string>();
      for (const root of roots) {
        const located = await this.locator.locate(root);
        if (located.status === "repository" && repositoryIdOf(located) === id) {
          alive.add(located.mainRoot);
        }
      }
      if (alive.size === 0) missing.push(...roots);
      for (const root of alive) live.add(root);
    }
    return {
      live: [...live].sort(),
      missing: missing.sort(),
      unlocated: [...ids].filter((id) => !rootsOf.has(id)).length,
    };
  }
}
