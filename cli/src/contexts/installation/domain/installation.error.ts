import type { Scope } from "../../../shared/domain/scope.js";
import { AiddError } from "../../../shared/domain/shared.error.js";

export class ActiveMachineDependentsError extends AiddError {
  readonly code = "active-machine-dependents";
  constructor(
    readonly target: string,
    readonly projects: readonly string[]
  ) {
    super();
  }
}

export class AiddFilesDetectedError extends AiddError {
  readonly code = "aidd-files-detected";
}

export class AlreadyInitializedError extends AiddError {
  readonly code = "already-initialized";
  /** `update` upgrades what is there; `clean-then-setup` is the way back to nothing. */
  constructor(readonly remedy: "update" | "clean-then-setup" = "update") {
    super();
  }
}

/** A hook entry or script is not what the install recorded, so removing or replacing it is refused. */
export class ProjectHooksEditedError extends AiddError {
  readonly code = "project-hooks-edited";
  constructor(readonly detail: string) {
    super();
  }
}

/** A user-scope plugin cannot be rebuilt: the shared framework source it is built from is gone. */
export class SharedSourceUnregisteredError extends AiddError {
  readonly code = "shared-source-unregistered";
  constructor(readonly detail: string) {
    super();
  }
}

/** A manifest this CLI cannot read by its version. `reinstall` is the scope to set up again once
 * the file is deleted; absent, the CLI is behind and updating answers. */
export class UnsupportedManifestVersionError extends AiddError {
  readonly code = "unsupported-manifest-version";
  constructor(
    readonly detail: string,
    readonly reinstall?: Scope
  ) {
    super();
  }
}

export class DuplicatePluginError extends AiddError {
  readonly code = "duplicate-plugin";
  constructor(readonly pluginName: string) {
    super();
  }
}

export class InvalidManifestDataError extends AiddError {
  readonly code = "invalid-manifest-data";
  constructor(readonly detail?: string) {
    super();
  }
}

export class InvalidManifestToolIdError extends AiddError {
  readonly code = "invalid-manifest-tool-id";
  constructor(readonly key: string) {
    super();
  }
}

export class InvalidPluginScopeError extends AiddError {
  readonly code = "invalid-plugin-scope";
  constructor(
    readonly toolId: string,
    readonly requested: Scope,
    readonly supported: Scope
  ) {
    super();
  }
}

// Not `InvalidPluginScopeError`, the CLI-facing "this tool does not support the scope you
// asked for": this one is a manifest integrity failure: the recorded
// `scope` field is missing or not one of the two values it may hold.
export class MalformedPluginScopeError extends AiddError {
  readonly code = "malformed-plugin-scope";
  constructor(
    readonly pluginName: string,
    readonly scope: unknown
  ) {
    super();
  }
}

export type ManifestUnavailableCode = "manifest-missing" | "manifest-corrupted";

/** A project's manifest cannot be had, for the reason the stable `code` names. */
export class ManifestUnavailableError extends AiddError {
  constructor(
    readonly code: ManifestUnavailableCode,
    options?: ErrorOptions
  ) {
    super(options);
  }
}

export class MissingPluginMetadataError extends AiddError {
  readonly code = "missing-plugin-metadata";
}

export class PluginNotFoundError extends AiddError {
  readonly code = "plugin-not-found";
  constructor(readonly pluginName: string) {
    super();
  }
}

export class ProjectScopeUnsupportedError extends AiddError {
  readonly code = "cursor-project-scope-unsupported";
}

export class ToolNotInstalledError extends AiddError {
  readonly code = "tool-not-installed";
  constructor(
    readonly toolId: string,
    readonly context?: string
  ) {
    super();
  }
}

export class UnresolvableUserScopeError extends AiddError {
  readonly code = "unresolvable-user-scope";
  constructor(readonly toolId: string) {
    super();
  }
}
