import { legacyRepositoryIdOf } from "../../domain/legacy/legacy-repository-identity.js";
import type { RepositoryAliasStore } from "../../domain/ports/repository-alias-store.js";
import type { RepositoryLocator } from "../../domain/ports/repository-locator.js";
import type { ResolutionStore } from "../../domain/ports/resolution-store.js";
import type { UsageLedger } from "../../domain/ports/usage-ledger.js";
import { repositoryIdOf } from "../../domain/repository-identity.js";

/** Brings what an earlier version stored to the rules of now: no call without a request id,
 * one id per repository. A stored id is a hash, so only a live clone's origin can say which id an earlier
 * version gave it: each root `roots.json` names is located, and the earlier id of its origin
 * mapped to the id of now. The table is written first; every reader of the ledger,
 * `roots.json` and the branch snapshots applies it from then on. Then every call with no request
 * id is left out, `roots.json` and every ledger partition are rewritten under the table, and the
 * table is marked complete, last. A run stopped anywhere leaves a state the next one completes with the same
 * table, asking git nothing. A root that could not be read, or was not there, stays pending:
 * each later run looks at those roots alone, and rewrites the stores again only when one of
 * them adds an id. Runs under the ledger's lock. */
export class StoredUsageMigration {
  constructor(
    private readonly locator: RepositoryLocator,
    private readonly resolutions: ResolutionStore,
    private readonly aliases: RepositoryAliasStore,
    private readonly ledger: UsageLedger
  ) {}

  async execute(): Promise<void> {
    const held = await this.aliases.load();
    let table = held;
    if (table === null || table.complete) {
      const roots = table?.pending ?? (await this.roots());
      const found = await this.locate(roots);
      const ids = new Map([...(table?.ids ?? []), ...found.ids]);
      if (table !== null && ids.size === table.ids.size) {
        // Nothing new: only the roots still pending may have changed.
        if (found.pending.length < table.pending.length) {
          await this.aliases.save({ ...table, pending: found.pending });
        }
        return;
      }
      table = { ids, complete: false, pending: found.pending };
      await this.aliases.save(table);
    }
    const roots = await this.resolutions.load();
    if (roots.size > 0) await this.resolutions.save(roots);
    await this.ledger.leaveOutRequestless();
    // Every partition, not only the ones a read finds unsettled: a day is put in the order one
    // ingest writes, whatever order it was found in. One already in it is not touched.
    await this.ledger.save((await this.ledger.load()).records);
    await this.aliases.save({ ...table, complete: true });
  }

  private async roots(): Promise<string[]> {
    return [...new Set([...(await this.resolutions.load()).values()].map((r) => r.root))];
  }

  private async locate(
    roots: readonly string[]
  ): Promise<{ ids: Map<string, string>; pending: string[] }> {
    const ids = new Map<string, string>();
    const pending: string[] = [];
    for (const root of roots) {
      const located = await this.locator.locate(root);
      if (located.status === "unreadable" || located.status === "gone") pending.push(root);
      if (located.status !== "repository") continue;
      // Both rules fall back to the root commit alike, so one is null only when both are.
      const earlier = legacyRepositoryIdOf(located);
      const now = repositoryIdOf(located);
      if (earlier !== now) ids.set(earlier as string, now as string);
    }
    return { ids, pending };
  }
}
