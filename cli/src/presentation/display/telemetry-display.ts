import type { IngestResult } from "../../contexts/telemetry/application/ingest-usage-use-case.js";
import type { NotStoredReason } from "../../contexts/telemetry/domain/repository-resolution.js";
import type { CLIOutput } from "../output.js";

const REASONS: Readonly<Record<NotStoredReason, string>> = {
  "outside-repo": "outside any repository",
  "never-seen-alive": "from a directory never seen while it existed",
  "no-consent": "from a project that has not opted in",
  "unreadable-consent": "from a project whose .aidd/config.json cannot be parsed",
  "no-cwd": "with no working directory",
  undated: "with no usable time",
};

export function printIngestResult(output: CLIOutput, result: IngestResult): void {
  if (result.refused) {
    output.info("AIDD_TELEMETRY=0: nothing was read and nothing was stored.");
    return;
  }
  output.success(
    `Read ${result.filesRead} transcript${result.filesRead === 1 ? "" : "s"}: ` +
      `${result.added} call${result.added === 1 ? "" : "s"} added, ${result.updated} updated.`
  );
  if (result.unrecognised > 0) {
    output.warn(
      `${result.unrecognised} shape${result.unrecognised === 1 ? "" : "s"} not recognised and not counted.`
    );
  }
  if (result.skippedLedgerLines > 0) {
    output.warn(
      `${result.skippedLedgerLines} ledger line${result.skippedLedgerLines === 1 ? " was" : "s were"} not a record and dropped.`
    );
  }
  if (result.snapshots > 0) {
    output.info(
      `${result.snapshots} branch declaration${result.snapshots === 1 ? "" : "s"} snapshotted.`
    );
  }
  for (const [reason, count] of Object.entries(result.notStored) as [NotStoredReason, number][]) {
    if (count > 0)
      output.info(`Not stored: ${count} call${count === 1 ? "" : "s"} ${REASONS[reason]}.`);
  }
}
