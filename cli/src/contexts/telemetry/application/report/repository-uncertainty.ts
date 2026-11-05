import type { UsageLedger } from "../../domain/ports/usage-ledger.js";
import { repositoryUncertain } from "../../domain/repository-resolution.js";
import type { StoredUsage } from "../../domain/stored-usage.js";
import type { UsageTool } from "../../domain/usage-record.js";
import type { DirectoryResolver } from "../directory-resolver.js";
import { settleLedger } from "../ledger-upkeep.js";

/** Settles and annotates a report's ledger under the same lock. */
export class ReportLedger {
  constructor(
    private readonly ledger: UsageLedger,
    private readonly directories?: Pick<DirectoryResolver, "open">
  ) {}

  async read(holds?: (day: string) => boolean, tool?: UsageTool, includeLeftOut = false) {
    return this.ledger.exclusively(async () => {
      const held = await settleLedger(this.ledger, holds);
      const selected = tool ? held.records.filter((record) => record.tool === tool) : held.records;
      const records = this.directories
        ? await withRepositoryUncertainty(selected, this.directories)
        : selected.map((record) => ({ ...record, repository_uncertain: true as const }));
      const leftOut = includeLeftOut ? await this.ledger.leftOut.counts() : undefined;
      return { records, skippedLines: held.skippedLines, leftOut };
    });
  }
}

/** Annotates stored usage without changing token counts or rewriting the ledger.
 * The caller holds the ledger lock while the resolver observes and saves changes. */
export async function withRepositoryUncertainty(
  records: readonly StoredUsage[],
  directories: Pick<DirectoryResolver, "open">
): Promise<readonly StoredUsage[]> {
  const run = await directories.open();
  try {
    // Observe every directory before attributing any record: another working tree may
    // reveal a changed origin for a clone already visited in this same run.
    const observed = new Set<string>();
    for (const record of records) {
      if (record.cwd && !observed.has(record.cwd)) {
        observed.add(record.cwd);
        await run.resolve(record.cwd, record.at);
      }
    }
    const annotated: StoredUsage[] = [];
    for (const record of records) {
      const outcome = record.cwd ? await run.resolve(record.cwd, record.at) : null;
      const uncertain =
        record.repository_uncertain === true ||
        !outcome ||
        "skipped" in outcome ||
        !outcome.live ||
        outcome.stored.repository_id !== record.repository_id ||
        repositoryUncertain(outcome.stored, record.at);
      annotated.push(uncertain ? { ...record, repository_uncertain: true } : record);
    }
    return annotated;
  } finally {
    await run.close();
  }
}
