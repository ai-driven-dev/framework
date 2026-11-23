import { AiddError } from "../shared/domain/shared.error.js";

export class AmbiguousPluginMatchError extends AiddError {
  readonly code = "ambiguous-plugin-match";
  constructor(
    readonly plugin: string,
    readonly marketplaces: readonly string[]
  ) {
    super();
  }
}

export class InteractiveOnlyError extends AiddError {
  readonly code = "interactive-only";
  constructor(readonly action: string) {
    super();
  }
}

export class NoMarketplacesRegisteredError extends AiddError {
  readonly code = "no-marketplaces-registered";
}

/** What a failed native activation refreshed no agent plugin for: each scope's own failure. */
export class AgentPluginActivationError extends AiddError {
  readonly code = "agent-plugin-activation";
  constructor(readonly errors: readonly { scope: string; error: unknown }[]) {
    super();
  }
}

/** Each failure already reached the user through its own `output.warn` line, so the words name
 * only the scopes and let the CLI's one exit turn a partly failed sync into a non-zero exit. */
export class SyncFailedError extends AiddError {
  readonly code = "sync-failed";
  constructor(readonly errors: readonly { scope: string; error: unknown }[]) {
    super();
  }
}

export class TrustDeniedError extends AiddError {
  readonly code = "trust-denied";
  constructor(readonly marketplace: string) {
    super();
  }
}

export class UserScopeFilterUnsupportedError extends AiddError {
  readonly code = "user-scope-filter-unsupported";
  constructor(
    readonly flag: string,
    readonly command: string
  ) {
    super();
  }
}

export class UserScopeUnavailableError extends AiddError {
  readonly code = "user-scope-unavailable";
}

/** A tool's user plugin files failed after preflight: a native ref may already be refreshed. */
export class UserPluginUpdatePartialError extends AiddError {
  readonly code = "user-plugin-update-partial";
  constructor(
    readonly toolId: string,
    options: ErrorOptions
  ) {
    super(options);
  }
}
