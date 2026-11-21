import { AiddError } from "../shared/domain/shared.error.js";

/** `aidd telemetry identity --off` given an identifier to set. */
export class IdentityOffWithIdentifierError extends AiddError {
  readonly code = "identity-off-with-identifier";
  constructor() {
    super("--off removes the identity: give it no identifier.");
    this.name = "IdentityOffWithIdentifierError";
  }
}

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

export class UnknownAiToolIdError extends AiddError {
  readonly code = "unknown-ai-tool-id";
  constructor(tool: string, validIds: readonly string[]) {
    super(`Unknown AI tool: ${tool}. Valid AI tools: ${validIds.join(", ")}`);
    this.name = "UnknownAiToolIdError";
  }
}

export class UserScopeFilterUnsupportedError extends AiddError {
  readonly code = "user-scope-filter-unsupported";
  constructor(flag: string, command: string) {
    super(
      `--scope user tracks nothing ${flag} can narrow — it names every requested tool, ` +
        `not one plugin or one file. Drop ${flag}, or run \`aidd ${command}\` at project scope.`
    );
    this.name = "UserScopeFilterUnsupportedError";
  }
}
