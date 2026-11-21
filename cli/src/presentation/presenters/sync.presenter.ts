import { assertActivated } from "../../orchestration/domain/activation-outcome.model.js";
import type { Output } from "../../orchestration/domain/output.js";
import type { ToolId } from "../../shared/domain/tool.js";
import { render } from "../errors/error-translator.presenter.js";
import { printNativeActivation, printUnrestorable } from "./restore.presenter.js";

interface ScopedError {
  readonly scope: string;
  readonly error: unknown;
}

interface RestoreAllResult {
  readonly errors: readonly ScopedError[];
  readonly totalRestored: number;
  readonly totalKept: number;
  readonly pluginNamesRestored: readonly string[];
  readonly unrestorable: readonly string[];
}

interface ToolRestoreResult {
  readonly tools: readonly { readonly nothingToRestore: boolean }[];
  readonly totalRestored: number;
  readonly totalKept: number;
  readonly unrestorable: readonly string[];
}

interface ActivationOutcome {
  readonly binaryMissing: readonly { readonly toolId: ToolId; readonly binary: string }[];
  readonly errors: readonly ScopedError[];
}

export function printRestoreOutcome(output: Output, result: RestoreAllResult): void {
  for (const e of result.errors) output.warn(`[${e.scope}] ${render(e.error)}`);

  const nothingToRestore =
    result.errors.length === 0 &&
    result.totalRestored === 0 &&
    result.pluginNamesRestored.length === 0 &&
    result.unrestorable.length === 0;
  if (nothingToRestore) {
    output.success("Nothing to restore — all files are unmodified.");
    return;
  }
  if (result.totalRestored > 0) {
    output.success(`Restored ${result.totalRestored} file(s), kept ${result.totalKept} file(s)`);
  }
  if (result.pluginNamesRestored.length > 0) {
    output.success(`Restored plugins: ${result.pluginNamesRestored.join(", ")}`);
  }
  printUnrestorable(output, result.unrestorable);
}

export function printToolRestoreOutcome(output: Output, result: ToolRestoreResult): void {
  const nothingDone = result.tools.every((t) => t.nothingToRestore);
  if (nothingDone) {
    output.success("Nothing to restore — all files are unmodified.");
    return;
  }
  output.success(
    `Restored ${result.totalRestored} ${result.totalRestored === 1 ? "file" : "files"}, kept ${result.totalKept} ${result.totalKept === 1 ? "file" : "files"}`
  );
  printUnrestorable(output, result.unrestorable);
}

/** Every line native activation produced, in the order a host's own CLI produced them: a
 * missing binary first, then whatever the run refused. The refusal itself stays the caller's. */
export function printActivationOutcome(output: Output, activation: ActivationOutcome): void {
  printNativeActivation(output, activation.binaryMissing);
  for (const e of activation.errors) output.warn(`[${e.scope}] ${render(e.error)}`);
}

export function printUserScopeSyncOutcome(
  output: Output,
  activated: readonly string[],
  refreshed: readonly string[] = []
): void {
  if (refreshed.length > 0) output.success(`Refreshed global files for: ${refreshed.join(", ")}`);
  if (activated.length > 0) {
    output.success(`Synced native activation for: ${activated.join(", ")}`);
  } else if (refreshed.length === 0) {
    output.success("Nothing to sync — no tool is registered at user scope yet.");
  }
}

/** Named structurally: every real caller's result already satisfies this shape. */
interface SyncActivationOutcome {
  readonly errors: readonly ScopedError[];
  readonly failed: boolean;
}

export function printScopedFailures(output: Output, failures: readonly ScopedError[]): void {
  for (const failure of failures) output.warn(`[${failure.scope}] ${render(failure.error)}`);
}

/** Prints what an activation reported and turns its `failed` verdict into the failing exit.
 * A result thrown away would turn a refusal into exit 0 with nothing printed and a plugin that
 * never loads. */
export function reportNativeActivation(output: Output, activation: SyncActivationOutcome): void {
  printScopedFailures(output, activation.errors);
  assertActivated(activation);
}
