import type { IngestUsageResult } from "../../../contexts/telemetry/application/ingest-usage.use-case.js";
import type { NotStoredReason } from "../../../contexts/telemetry/contract/repository-resolution.js";
import type { Output } from "../../../orchestration/domain/output.js";

/** What a shape the reader did not recognise came to: a call lacking a counter is stored with it
 * unknown, never zero; a line that is no usage line is no call (what is kept of it is said
 * apart, from every read). */
export const UNRECOGNISED_WORDS =
  "not recognised by this read: a call missing a counter is kept with that counter unknown; a line that is no usage line is never a call.";

const isNotStoredReason = (key: string): key is NotStoredReason =>
  Object.hasOwn(NOT_STORED_WORDS, key);

/** Why a billed call was read and not stored, as the end of a sentence about N calls. */
export const NOT_STORED_WORDS: Readonly<Record<NotStoredReason, string>> = {
  "outside-repo": "outside any repository",
  "never-seen-alive": "from a directory never seen while it existed",
  "no-consent": "from a clone with no consent at that time",
  "consent-closed":
    "from a clone whose consent was closed; run `aidd telemetry on` in it to measure again",
  "unreadable-consent":
    "from a clone whose consent cannot be read: its git config, its git directory, or a damaged ledger/consents.jsonl",
  "no-cwd": "with no working directory",
  undated: "with no usable time",
};

/** Said on every run while `ledger/consents.jsonl` cannot be trusted. Recovery is `forget`, not
 * a hand edit: a line removed by hand can reopen a window that was closed. */
export const DAMAGED_CONSENT_LOG =
  "ledger/consents.jsonl holds a line that is not a consent event, so the log cannot be trusted and";
/** The way out of a damaged consent log, finished by where `on` is run again. */
export const FORGET_THEN_ON = "Run `aidd telemetry forget --yes`, then `aidd telemetry on`";
export const DAMAGED_CONSENT_LOG_WORDS = `${DAMAGED_CONSENT_LOG} nothing is stored for any clone. ${FORGET_THEN_ON} in each clone to measure again: nothing from before is stored.`;

export function grouped(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function count(n: number, one: string, many: string): string {
  return `${grouped(n)} ${n === 1 ? one : many}`;
}

/** What was read and left out, one line each: by an ingest of its own run, by a report of its
 * period. A ledger line that is not a record is never removed: a newer version may have
 * written it. */
export function leftOutLines(
  left: Pick<
    IngestUsageResult,
    "unrecognised" | "notStored" | "consentLogDamaged" | "skippedLedgerLines"
  >
): { readonly warn: boolean; readonly text: string }[] {
  const lines = [];
  if (left.unrecognised > 0) {
    lines.push({
      warn: true,
      text: `${count(left.unrecognised, "shape", "shapes")} ${UNRECOGNISED_WORDS}`,
    });
  }
  for (const [reason, n] of Object.entries(left.notStored)) {
    if (n > 0 && isNotStoredReason(reason)) {
      const text = `Not stored by this read: ${count(n, "call", "calls")} ${NOT_STORED_WORDS[reason]}.`;
      lines.push({ warn: false, text });
    }
  }
  if (left.consentLogDamaged) lines.push({ warn: true, text: DAMAGED_CONSENT_LOG_WORDS });
  const kept = left.skippedLedgerLines;
  if (kept > 0) {
    const text = `${count(kept, "ledger line is", "ledger lines are")} not a record, kept as found.`;
    lines.push({ warn: true, text });
  }
  return lines;
}

export function printIngestResult(output: Output, result: IngestUsageResult): void {
  if (result.refused) {
    output.info("AIDD_TELEMETRY=0: nothing was read and nothing was stored.");
    return;
  }
  output.success(
    `Read ${count(result.filesRead, "transcript", "transcripts")}: ` +
      `${count(result.added, "call", "calls")} added, ${grouped(result.updated)} updated.`
  );
  if (result.snapshots > 0) {
    output.info(
      `${count(result.snapshots, "branch declaration", "branch declarations")} snapshotted.`
    );
  }
  // A call not stored is information; a line that could not be read, a warning.
  for (const { warn, text } of leftOutLines(result)) {
    if (warn) output.warn(text);
    else output.info(text);
  }
}
