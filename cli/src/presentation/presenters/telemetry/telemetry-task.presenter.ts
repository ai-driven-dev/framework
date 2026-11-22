import type { DeclareTaskResult } from "../../../contexts/telemetry/application/declaration/declare-task.use-case.js";
import type { RefusalReason } from "../../../contexts/telemetry/application/find-consented-repository.use-case.js";
import type { ReadTelemetryStatusResult } from "../../../contexts/telemetry/application/read-telemetry-status.use-case.js";
import type { Output } from "../../../orchestration/domain/output.js";

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

export function printDeclareResult(output: Output, result: DeclareTaskResult): void {
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

export function printTelemetryStatus(output: Output, result: ReadTelemetryStatusResult): void {
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

type ShownStatus = Extract<ReadTelemetryStatusResult, { status: "shown" }>;

function describeUnbound({ sessionId, branch, role }: ShownStatus): string {
  if (role === "working") {
    const session = sessionId === null ? "no session" : `session ${shortSession(sessionId)}`;
    return `branch ${branch} and ${session}`;
  }
  return `${role === "detached" ? "a detached HEAD" : `the default branch ${branch}`}, which is never bound`;
}

function describeBoundSource(
  binding: Extract<ShownStatus["binding"], { state: "bound" }>,
  { sessionId, branch }: ShownStatus,
  what: string
): string {
  const when = binding.declaredAt === null ? "" : ` at ${binding.declaredAt}`;
  if (binding.source === "branch") return `Bound to ${what}, declared on branch ${branch}${when}.`;
  if (binding.source === "session-carried") {
    return `Bound to ${what}, carried into session ${shortSession(sessionId ?? "")} from session ${shortSession(binding.carriedFrom ?? "")}.`;
  }
  return `Bound to ${what}, declared in session ${shortSession(sessionId ?? "")}${when}.`;
}

function printBinding(output: Output, result: ShownStatus): void {
  const { binding } = result;
  if (binding.state === "unbound") {
    output.info(
      `Nothing is bound: ${describeUnbound(result)}. Declare with \`aidd telemetry task <name>\`.`
    );
    return;
  }
  const what = binding.none
    ? "no task (declared none)"
    : describeTask(binding.task, binding.ticket);
  output.info(describeBoundSource(binding, result, what));
}
