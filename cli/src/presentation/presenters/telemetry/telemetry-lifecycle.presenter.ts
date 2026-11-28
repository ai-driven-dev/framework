import type {
  ForgetPlan,
  ForgetTelemetryResult,
} from "../../../contexts/telemetry/application/forget/forget-telemetry.use-case.js";
import type { DisableTelemetryResult } from "../../../contexts/telemetry/application/switch/disable-telemetry.use-case.js";
import type {
  EnableTelemetryResult,
  OnIdentity,
} from "../../../contexts/telemetry/application/switch/enable-telemetry.use-case.js";
import type { ReadTranscriptRetentionResult } from "../../../contexts/telemetry/application/switch/read-transcript-retention.use-case.js";
import {
  RETENTION_DEFAULT_DAYS,
  RETENTION_WANTED_DAYS,
} from "../../../contexts/telemetry/contract/claude-retention.js";
import type { ErasureKind } from "../../../contexts/telemetry/contract/measurement-erasure.js";
import type { Output } from "../../terminal/output.model.js";
import { IDENTITY_RULE } from "./telemetry-identity.presenter.js";
import { DAMAGED_CONSENT_LOG, FORGET_THEN_ON } from "./telemetry-read.presenter.js";

const INVALID_IDENTITY_REFUSAL = `${IDENTITY_RULE} Nothing was changed.`;

const REFUSALS = {
  "outside-repository": "This directory is not inside a git repository.",
  "unreadable-git-config":
    "This clone's git config cannot be read, so its consent was left as it is. Fix it, then run this again.",
  "damaged-consent-log": `${DAMAGED_CONSENT_LOG} nothing was changed. ${FORGET_THEN_ON} again: nothing from before is stored.`,
  "unidentified-clone":
    "This file system gives the clone's git directory no identity, so nothing measured here could be told to be its own. Nothing was changed.",
  "invalid-identity": INVALID_IDENTITY_REFUSAL,
  "identity-set":
    "An identity is set, so this clone cannot be measured anonymously. Remove it with `aidd telemetry identity --off`, then run this again. Nothing was changed.",
} as const;

function plural(count: number, noun: string, nouns = `${noun}s`): string {
  return `${count} ${count === 1 ? noun : nouns}`;
}

function identityLine({ personId, previous }: OnIdentity): string {
  if (personId === null) {
    return 'Measured anonymously: the person axis shows "anonymous". To be named, run `aidd telemetry identity <id>`.';
  }
  const before = previous === null || previous === personId ? "" : `, no longer as "${previous}"`;
  return `Measured as "${personId}"${before}.`;
}

/** A typed identifier refused, before it is asked for again. */
export function printIdentityRule(output: Output): void {
  output.warn(IDENTITY_RULE);
}

/** What `on` did, with how long Claude Code keeps the transcripts of a clone it turned on. */
type OnOutcome =
  | Extract<EnableTelemetryResult, { status: "refused" }>
  | (Extract<EnableTelemetryResult, { status: "on" }> & {
      readonly retention: ReadTranscriptRetentionResult;
    });

export function printOnResult(output: Output, result: OnOutcome): void {
  if (result.status === "refused") {
    output.error(REFUSALS[result.reason]);
    return;
  }
  output.success(
    result.consentWritten
      ? "Measurement is on for this clone, from now: calls made before this moment are not counted. `git config aidd.telemetry` holds this clone's own token, in this clone's own config."
      : "Measurement was already on for this clone."
  );
  output.info(
    "That setting is shared by this clone's linked worktrees and is never committed: a teammate is measured only after running `aidd telemetry on` in their own clone."
  );
  if (result.retention.short) {
    const days = result.retention.days;
    output.warn(
      `Claude Code keeps transcripts for ${days} day${days === 1 ? "" : "s"}` +
        `${days === RETENTION_DEFAULT_DAYS ? " (its default)" : ""}. A call is measured only if it is read before then. ` +
        `To keep them longer, add \`"cleanupPeriodDays": ${RETENTION_WANTED_DAYS}\` to your Claude settings.json.`
    );
  }
  output.info(identityLine(result.identity));
  output.info(
    "Next: declare what you work on with `aidd telemetry task <name> [--ticket <ref>]`, or `--none` for no task. " +
      "In Claude Code and the Codex TUI, the aidd-telemetry plugin reminds you at session start on an undeclared working branch."
  );
}

export function printOffResult(output: Output, result: DisableTelemetryResult): void {
  if (result.status === "refused") {
    output.error(REFUSALS[result.reason]);
    return;
  }
  output.success(
    result.changed
      ? "Measurement is off for this clone. What was measured stays until `aidd telemetry forget --yes`."
      : "Measurement was not on for this clone."
  );
}

const WHAT: Readonly<Record<ErasureKind, string>> = {
  ledger: "the ledger of billed calls",
  bindings: "the declarations kept beside it",
  identity: "your identity",
};

function listKept(output: Output, plan: ForgetPlan): void {
  for (const entry of plan.entries) {
    output.info(`  - ${WHAT[entry.kind]}: ${entry.path} (${plural(entry.files, "file")})`);
  }
  for (const repository of plan.repositories) {
    if (repository.taskKeys > 0) {
      output.info(
        `  - ${plural(repository.taskKeys, "branch task key")} in the git config of ${repository.clone}`
      );
    }
    if (repository.consent) {
      output.info(`  - the consent (aidd.telemetry) in the git config of ${repository.clone}`);
    }
  }
}

function warnSkipped(output: Output, plan: ForgetPlan): void {
  for (const root of plan.missing) {
    output.warn(`Skipped ${root}: it is gone, or is no longer that clone.`);
  }
  if (plan.unlocated > 0) {
    output.warn(
      `${plural(plan.unlocated, "repository", "repositories")} declared a task and could not be located.`
    );
  }
}

function empty(plan: ForgetPlan): boolean {
  return (
    plan.entries.length === 0 && plan.repositories.every((r) => r.taskKeys === 0 && !r.consent)
  );
}

export function printForgetResult(output: Output, result: ForgetTelemetryResult): void {
  if (empty(result.plan)) {
    output.info("Nothing measured is kept on this machine.");
    warnSkipped(output, result.plan);
    return;
  }
  if (result.status === "preview") {
    output.info("This would remove:");
    listKept(output, result.plan);
    warnSkipped(output, result.plan);
    output.info("Nothing was removed. Run `aidd telemetry forget --yes` to remove it.");
    return;
  }
  output.success("Removed:");
  listKept(output, result.plan);
  warnSkipped(output, result.plan);
}
