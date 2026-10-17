import { legacyRepositoryIdOf } from "../../domain/legacy/legacy-repository-identity.js";
import type { RepositoryAliasStore } from "../../domain/ports/repository-alias-store.js";
import type { RepositoryLocator } from "../../domain/ports/repository-locator.js";
import type { ResolutionStore } from "../../domain/ports/resolution-store.js";
import type { UsageLedger } from "../../domain/ports/usage-ledger.js";
import { repositoryIdOf } from "../../domain/repository-identity.js";
import { settleLedger } from "../ledger-upkeep.js";

/** Brings what an earlier version stored to the rules of now: one key per call, one id per
 * repository. A stored id is a hash, so only a live clone's origin can say which id an earlier
 * version gave it: each root `roots.json` names is located once, and the earlier id of its
 * origin mapped to the id of now. The table is written first; every reader of the ledger,
 * `roots.json` and the branch snapshots applies it, and the key rule, from then on. Then
 * `roots.json` and every ledger partition are rewritten under it, and the table is marked
 * complete, last. A run stopped anywhere leaves a state the next one completes with the same
 * table, asking git nothing. Runs under the ledger's lock. */
export class StoredUsageMigration {
  constructor(
    private readonly locator: RepositoryLocator,
    private readonly resolutions: ResolutionStore,
    private readonly aliases: RepositoryAliasStore,
    private readonly ledger: UsageLedger
  ) {}

  async execute(): Promise<void> {
    const held = await this.aliases.load();
    if (held?.complete) return;
    const ids = held?.ids ?? (await this.table());
    if (held === null) await this.aliases.save({ ids, complete: false });
    const roots = await this.resolutions.load();
    if (roots.size > 0) await this.resolutions.save(roots);
    await settleLedger(this.ledger);
    await this.aliases.save({ ids, complete: true });
  }

  private async table(): Promise<Map<string, string>> {
    const roots = [...new Set([...(await this.resolutions.load()).values()].map((r) => r.root))];
    const ids = new Map<string, string>();
    for (const root of roots) {
      const located = await this.locator.locate(root);
      if (located.status !== "repository") continue;
      // Both rules fall back to the root commit alike, so one is null only when both are.
      const earlier = legacyRepositoryIdOf(located);
      const now = repositoryIdOf(located);
      if (earlier !== now) ids.set(earlier as string, now as string);
    }
    return ids;
  }
}
