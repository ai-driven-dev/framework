import type { RefusalReason } from "../../contexts/telemetry/application/consented-repositories.js";
import type { DeclareResult } from "../../contexts/telemetry/application/declare-task-use-case.js";
import type { IdentityResult } from "../../contexts/telemetry/application/identity/manage-identity-use-case.js";
import type { IngestResult } from "../../contexts/telemetry/application/ingest-usage-use-case.js";
import type { StatusResult } from "../../contexts/telemetry/application/telemetry-status-use-case.js";
import type { NotStoredReason } from "../../contexts/telemetry/domain/repository-resolution.js";
import type { CLIOutput } from "../output.js";

export const IDENTITY_RULE = "An identity is one non-empty line of at most 128 characters.";

/** What a shape the reader did not recognise came to: a call lacking a counter is stored with it
 * unknown, never zero; a line that is no usage line is no call (what is kept of it is said
 * apart, from every read). */
export const UNRECOGNISED_WORDS =
  "not recognised by this read: a call missing a counter is kept with that counter unknown; a line that is no usage line is never a call.";

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
    IngestResult,
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
  for (const [reason, n] of Object.entries(left.notStored) as [NotStoredReason, number][]) {
    const text = `Not stored by this read: ${count(n, "call", "calls")} ${NOT_STORED_WORDS[reason]}.`;
    if (n > 0) lines.push({ warn: false, text });
  }
  if (left.consentLogDamaged) lines.push({ warn: true, text: DAMAGED_CONSENT_LOG_WORDS });
  const kept = left.skippedLedgerLines;
  if (kept > 0) {
    const text = `${count(kept, "ledger line is", "ledger lines are")} not a record, kept as found.`;
    lines.push({ warn: true, text });
  }
  return lines;
}

export function printIngestResult(output: CLIOutput, result: IngestResult): void {
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

const REFUSALS: Readonly<Record<RefusalReason, string>> = {
  environment: "AIDD_TELEMETRY=0: nothing was declared.",
  "outside-repository": "Not inside a git repository: there is no project to declare a task in.",
  "unidentified-repository":
    "This repository has no remote and no commit yet, so nothing can name it. Commit once, then declare again.",
  "no-consent":
    "This clone has not opted in to measurement, so no task was declared. Run `aidd telemetry on` here first.",
  "turned-off":
    "Measurement was turned off in this clone, so no task was declared. Run `aidd telemetry on` here to measure it again.",
  "unreadable-consent":
    "This clone's git config cannot be read, so no task was declared. Fix it, then declare again.",
};

const NOT_MEASURED: Readonly<Record<RefusalReason, string>> = {
  environment: "Not measured: AIDD_TELEMETRY=0.",
  "outside-repository": "Not measured: not inside a git repository.",
  "unidentified-repository": "Not measured: this repository has no remote and no commit yet.",
  "no-consent": "Not measured: this clone has not run `aidd telemetry on`.",
  "turned-off":
    "Not measured: measurement was turned off in this clone. Run `aidd telemetry on` to measure it again.",
  "unreadable-consent": "Not measured: this clone's git config or the consent log cannot be read.",
};

/** The first characters of a session id: enough to tell sessions apart on one screen. */
function shortSession(sessionId: string): string {
  return sessionId.slice(0, 8);
}

function describeTask(task: string | null, ticket: string | null): string {
  if (task === null) return "no task";
  return ticket === null ? `task "${task}"` : `task "${task}" (ticket ${ticket})`;
}

export function printDeclareResult(output: CLIOutput, result: DeclareResult): void {
  if (result.status === "refused") {
    output.error(REFUSALS[result.reason]);
    return;
  }
  const { declaration, sessionId, branch } = result;
  output.success(`Declared ${describeTask(declaration.task, declaration.ticket)}.`);
  if (sessionId === null) {
    output.info("No Claude session here: nothing was bound to a session.");
  } else {
    output.info(`Session ${shortSession(sessionId)} is bound from now on.`);
  }
  if (branch.status === "bound") {
    output.info(`Branch ${branch.branch} is bound.`);
    return;
  }
  output.info(
    branch.reason === "detached"
      ? "Branch left untouched: HEAD is detached."
      : `Branch left untouched: ${branch.branch} is the default branch.`
  );
  if (sessionId === null) output.warn("Nothing was bound: no session and no working branch.");
}

export function printTelemetryStatus(output: CLIOutput, result: StatusResult): void {
  if (result.status === "refused") {
    output.info(NOT_MEASURED[result.reason]);
    return;
  }
  output.info(`This clone is measured since ${result.since.slice(0, 10)}.`);
  printBinding(output, result);
  output.info(
    result.personId === null
      ? "Measured anonymously. To be named, run `aidd telemetry identity <id>`."
      : `Measured as "${result.personId}".`
  );
}

function printBinding(output: CLIOutput, result: Extract<StatusResult, { status: "shown" }>): void {
  const { binding, sessionId, branch, role } = result;
  if (binding.state === "unbound") {
    const where =
      role === "working"
        ? `branch ${branch} and ${sessionId === null ? "no session" : `session ${shortSession(sessionId)}`}`
        : `${role === "detached" ? "a detached HEAD" : `the default branch ${branch}`}, which is never bound`;
    output.info(`Nothing is bound: ${where}. Declare with \`aidd telemetry task <name>\`.`);
    return;
  }
  const what = binding.none
    ? "no task (declared none)"
    : describeTask(binding.task, binding.ticket);
  const when = binding.declaredAt === null ? "" : ` at ${binding.declaredAt}`;
  if (binding.source === "branch") {
    output.info(`Bound to ${what}, declared on branch ${branch}${when}.`);
  } else if (binding.source === "session-carried") {
    output.info(
      `Bound to ${what}, carried into session ${shortSession(sessionId ?? "")} from session ${shortSession(binding.carriedFrom ?? "")}.`
    );
  } else {
    output.info(`Bound to ${what}, declared in session ${shortSession(sessionId ?? "")}${when}.`);
  }
}

export function printIdentityResult(output: CLIOutput, result: IdentityResult): void {
  switch (result.status) {
    case "set":
      output.success(`Measurement names you as "${result.personId}". Stop with \`--off\`.`);
      return;
    case "removed":
      output.success('Identity removed: the person axis shows "anonymous".');
      return;
    case "unset":
      output.info(
        'No identity is set: the person axis shows "anonymous". Choose one with `aidd telemetry identity <id>`.'
      );
      return;
    case "refused":
      output.error(IDENTITY_RULE);
  }
}
