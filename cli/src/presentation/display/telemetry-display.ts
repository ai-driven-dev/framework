import type { RefusalReason } from "../../contexts/telemetry/application/consented-repositories.js";
import type { DeclareResult } from "../../contexts/telemetry/application/declare-task-use-case.js";
import type { IdentityResult } from "../../contexts/telemetry/application/identity/manage-identity-use-case.js";
import type { IngestResult } from "../../contexts/telemetry/application/ingest-usage-use-case.js";
import type { ShowResult } from "../../contexts/telemetry/application/show-task-binding-use-case.js";
import type { NotStoredReason } from "../../contexts/telemetry/domain/repository-resolution.js";
import type { CLIOutput } from "../output.js";

/** Why a billed call was read and not stored, as the end of a sentence about N calls. */
export const NOT_STORED_WORDS: Readonly<Record<NotStoredReason, string>> = {
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
      output.info(
        `Not stored: ${count} call${count === 1 ? "" : "s"} ${NOT_STORED_WORDS[reason]}.`
      );
  }
}

const REFUSALS: Readonly<Record<RefusalReason, string>> = {
  environment: "AIDD_TELEMETRY=0: nothing was declared.",
  "outside-repository": "Not inside a git repository: there is no project to declare a task in.",
  "unidentified-repository":
    "This repository has no remote and no commit yet, so nothing can name it. Commit once, then declare again.",
  "no-consent":
    "This project has not opted in to measurement, so no task was declared. Run `aidd telemetry on` here first.",
  "unreadable-consent":
    "This project's .aidd/config.json cannot be parsed, so no task was declared. Fix the file, then declare again.",
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

export function printTaskBinding(output: CLIOutput, result: ShowResult): void {
  if (result.status === "refused") {
    output.error(REFUSALS[result.reason]);
    return;
  }
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
      output.success('Identity removed: the person axis shows "not set".');
      return;
    case "unset":
      output.info(
        'No identity is set: the person axis shows "not set". Choose one with `aidd telemetry identity <id>`.'
      );
      return;
    case "refused":
      output.error("An identity is one line of at most 128 characters.");
  }
}
