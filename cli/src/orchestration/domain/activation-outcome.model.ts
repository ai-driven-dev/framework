import { SyncFailedError } from "../orchestration.error.js";

/** What an activation reported: the scopes it could not finish, and whether that fails the run. */
export interface ActivationOutcome {
  readonly errors: readonly { scope: string; error: unknown }[];
  readonly failed: boolean;
}

/** An activation that failed synced nothing for that scope, so the run must not end as if it had:
 * it throws, and the translator turns that into the non-zero exit. */
export function assertActivated(outcome: ActivationOutcome): void {
  if (outcome.failed) throw new SyncFailedError(outcome.errors);
}
