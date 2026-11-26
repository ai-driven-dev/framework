import type { ErasureEntry, MeasurementErasure } from "../../ports/forget/measurement-erasure.js";
import type {
  RepositoryDeclarations,
  RepositoryKeys,
} from "../../ports/forget/repository-declarations.js";
import type { UsageLedger } from "../../ports/usage-ledger.js";
import type { ReadRememberedClones } from "./read-remembered-clones.use-case.js";

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

export interface ForgetTelemetryRequest {
  readonly confirmed: boolean;
}

export type ForgetTelemetryResult =
  | { readonly status: "preview"; readonly plan: ForgetPlan }
  | { readonly status: "forgotten"; readonly plan: ForgetPlan };

function nothingToForget(plan: ForgetPlan): boolean {
  return (
    plan.entries.length === 0 &&
    plan.repositories.every((repository) => repository.taskKeys === 0 && !repository.consent)
  );
}

interface ForgetTelemetryDeps {
  readonly erasure: MeasurementErasure;
  readonly declarations: RepositoryDeclarations;
  readonly remembered: ReadRememberedClones;
  readonly ledger: UsageLedger;
}

/** Erases what measurement kept: previews by default, and removes only on confirmation. */
export class ForgetTelemetry {
  constructor(private readonly deps: ForgetTelemetryDeps) {}

  async execute({ confirmed }: ForgetTelemetryRequest): Promise<ForgetTelemetryResult> {
    const plan = await this.plan();
    if (!confirmed) return { status: "preview", plan };
    if (nothingToForget(plan)) return { status: "forgotten", plan };
    // Held for the whole removal, so no ingest writes into what is being erased. What goes is
    // read again under the lock, and that is what is reported.
    return this.deps.ledger.exclusively(async () => {
      const held = await this.plan();
      // The declarations first: they are found through the files that follow, so a crash
      // between the two leaves the way back to them.
      for (const repository of held.repositories)
        await this.deps.declarations.clear(repository.clone);
      await this.deps.erasure.erase();
      return { status: "forgotten" as const, plan: held };
    });
  }

  private async plan(): Promise<ForgetPlan> {
    const entries = await this.deps.erasure.inventory();
    const found = await this.deps.remembered.execute();
    const repositories: ({ clone: string } & RepositoryKeys)[] = [];
    const missing: string[] = [];
    for (const clone of found.clones) {
      const keys = await this.deps.declarations.count(clone);
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
}
