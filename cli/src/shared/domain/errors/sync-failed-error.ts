import { AiddError } from "./aidd-error.js";

/** Each failure already reached the user through its own `output.warn` line, so this names
 * only the scopes and lets `failCommand` be the one place turning a partly failed sync
 * into a non-zero exit. */
export class SyncFailedError extends AiddError {
  readonly code = "sync-failed";
  constructor(errors: readonly { scope: string; message: string }[]) {
    super(`Sync failed for: ${errors.map((e) => e.scope).join(", ")}. See the warnings above.`);
    this.name = "SyncFailedError";
  }
}
