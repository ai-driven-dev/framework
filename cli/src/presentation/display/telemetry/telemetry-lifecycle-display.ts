import type {
  ForgetPlan,
  ForgetResult,
} from "../../../contexts/telemetry/application/forget/forget-telemetry-use-case.js";
import type { OffResult } from "../../../contexts/telemetry/application/switch/telemetry-off-use-case.js";
import type { OnResult } from "../../../contexts/telemetry/application/switch/telemetry-on-use-case.js";
import type { ErasureKind } from "../../../contexts/telemetry/domain/ports/forget/measurement-erasure.js";
import {
  RETENTION_DEFAULT_DAYS,
  RETENTION_WANTED_DAYS,
} from "../../../contexts/telemetry/domain/switch/claude-retention.js";
import type { CLIOutput } from "../../output.js";

const REFUSALS = {
  "outside-repository": "This directory is not inside a git repository.",
  "unreadable-git-config":
    "This clone's git config cannot be read, so its consent was left as it is. Fix it, then run this again.",
  "unidentified-clone":
    "This file system gives the clone's git directory no identity, so nothing measured here could be told to be its own. Nothing was changed.",
} as const;

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function printOnResult(output: CLIOutput, result: OnResult): void {
  if (result.status === "refused") {
    output.error(REFUSALS[result.reason]);
    return;
  }
  output.success(
    result.consentWritten
      ? "Measurement is on for this clone: `git config aidd.telemetry` is 2 in this clone's own config."
      : "Measurement was already on for this clone."
  );
  output.info(
    "That setting is shared by this clone's linked worktrees and is never committed: a teammate is measured only after running `aidd telemetry on` in their own clone."
  );
  if (result.legacyConfig === "block-removed") {
    output.info(
      "Removed the previous version's telemetry block from .aidd/config.json. If that file is tracked, commit the change."
    );
  }
  if (result.legacyConfig === "file-deleted") {
    output.info(
      "Deleted .aidd/config.json: it held only the previous version's telemetry block. If it was tracked, commit the deletion."
    );
  }
  if (result.legacyConfig === "unparseable") {
    output.warn(
      ".aidd/config.json cannot be parsed, so it was left as it is. Remove its telemetry key by hand."
    );
  }
  const { hook, journal } = result;
  if (hook.lineRemoved) output.info("Removed the commit hook line the previous version added.");
  if (hook.delegateRemoved) output.info("Removed the script that line called.");
  if (hook.stillCalledBy.length > 0) {
    output.warn(
      `The previous version's commit script is kept because ${hook.stillCalledBy.join(", ")} still calls it. ` +
        "Remove that call, then delete the aidd-session-trailer.sh script from the hooks directory."
    );
  }
  if (journal.journalRemoved)
    output.info("Removed aidd_docs/runs/, the previous version's journal.");
  if (journal.trackedKept) {
    output.warn("aidd_docs/runs/ is tracked by git, so it was left in place.");
  }
  if (journal.ignoreEntryRemoved) output.info("Removed its aidd_docs/runs/ entry from .gitignore.");
  if (result.retention.short) {
    const days = result.retention.days;
    output.warn(
      `Claude Code keeps transcripts for ${days} day${days === 1 ? "" : "s"}` +
        `${days === RETENTION_DEFAULT_DAYS ? " (its default)" : ""}, and older history is lost. ` +
        `To keep it, add \`"cleanupPeriodDays": ${RETENTION_WANTED_DAYS}\` to your Claude settings.json.`
    );
  }
  output.info(
    "Next: declare what you work on with `aidd telemetry task <name> [--ticket <ref>]`, or `--none` for no task. " +
      "In Claude Code, the aidd-telemetry plugin's hooks ask for it before the first prompt on an undeclared working branch."
  );
}

export function printOffResult(output: CLIOutput, result: OffResult): void {
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
  "previous-day-file": "day files of the previous version",
  "previous-identity": "the previous version's identity",
};

function listKept(output: CLIOutput, plan: ForgetPlan): void {
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

function warnSkipped(output: CLIOutput, plan: ForgetPlan): void {
  for (const root of plan.missing) {
    output.warn(`Skipped ${root}: it is gone, or is no longer that clone.`);
  }
  if (plan.unlocated > 0) {
    output.warn(
      `${plural(plan.unlocated, "repository")} declared a task and could not be located.`
    );
  }
}

function empty(plan: ForgetPlan): boolean {
  return (
    plan.entries.length === 0 && plan.repositories.every((r) => r.taskKeys === 0 && !r.consent)
  );
}

export function printForgetResult(output: CLIOutput, result: ForgetResult): void {
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
