import type { Scope } from "../../../shared/domain/scope.js";
import { AiddError } from "../../../shared/domain/shared.error.js";

export class ActiveMachineDependentsError extends AiddError {
  readonly code = "active-machine-dependents";
  constructor(target: string, projects: readonly string[]) {
    super(`Cannot remove ${target}: active projects still depend on it: ${projects.join(", ")}.`);
    this.name = "ActiveMachineDependentsError";
  }
}

export class AiddFilesDetectedError extends AiddError {
  readonly code = "aidd-files-detected";
  constructor() {
    super(
      "AIDD files detected but no manifest found.\nRun `aidd setup` to register existing files."
    );
    this.name = "AiddFilesDetectedError";
  }
}

export class AlreadyInitializedError extends AiddError {
  readonly code = "already-initialized";
  constructor(message = "Already initialized. Use `aidd update` to upgrade.") {
    super(message);
    this.name = "AlreadyInitializedError";
  }
}

export class DuplicatePluginError extends AiddError {
  readonly code = "duplicate-plugin";
  constructor(name: string) {
    super(`Plugin '${name}' is already installed.`);
    this.name = "DuplicatePluginError";
  }
}

export class InvalidManifestDataError extends AiddError {
  readonly code = "invalid-manifest-data";
  constructor(detail?: string) {
    super(detail ? `Invalid manifest data: ${detail}` : "Invalid manifest data.");
    this.name = "InvalidManifestDataError";
  }
}

export class InvalidManifestToolIdError extends AiddError {
  readonly code = "invalid-manifest-tool-id";
  constructor(key: string) {
    super(`Invalid tool id in manifest: '${key}'.`);
    this.name = "InvalidManifestToolIdError";
  }
}

export class InvalidPluginNameError extends AiddError {
  readonly code = "invalid-plugin-name";
  constructor(name: string) {
    super(
      `Invalid plugin name: "${name}". Use lowercase alphanumeric characters and hyphens only.`
    );
    this.name = "InvalidPluginNameError";
  }
}

export class InvalidPluginScopeError extends AiddError {
  readonly code = "invalid-plugin-scope";
  constructor(toolId: string, requested: Scope, supported: Scope) {
    super(
      `Tool '${toolId}' does not support scope '${requested}'. Supported scope: '${supported}'. ` +
        `Re-run with --scope ${supported} or omit the flag.`
    );
    this.name = "InvalidPluginScopeError";
  }
}

export class InvalidPluginVersionError extends AiddError {
  readonly code = "invalid-plugin-version";
  constructor(version: string) {
    super(`Invalid plugin version: "${version}". Expected semver format (e.g. 1.0.0).`);
    this.name = "InvalidPluginVersionError";
  }
}

// Not `InvalidPluginScopeError`, the CLI-facing "this tool does not support the scope you
// asked for" (`install-scope.ts`): this one is a manifest integrity failure: the recorded
// `scope` field is missing or not one of the two values it may hold.
export class MalformedPluginScopeError extends AiddError {
  readonly code = "malformed-plugin-scope";
  constructor(pluginName: string, scope: unknown) {
    super(
      `Plugin "${pluginName}" carries an invalid scope: ${JSON.stringify(scope)}. Expected "project" or "user".`
    );
    this.name = "MalformedPluginScopeError";
  }
}

const MANIFEST_UNAVAILABLE_MESSAGE: Record<ManifestUnavailableCode, string> = {
  "manifest-missing": "No AIDD manifest found. Run `aidd setup` to initialize your project.",
  "manifest-corrupted":
    "Manifest is corrupted (invalid JSON). Run `aidd clean --force` and re-initialize.",
};

export type ManifestUnavailableCode = "manifest-missing" | "manifest-corrupted";

/** A project's manifest cannot be had, for the reason the stable `code` names.
 *
 * Both messages name a command, so target 03 §9.3 keys them on a presentation code-to-message
 * table. That translator is not built yet: until it is, the words stay here, as ratchet debt. */
export class ManifestUnavailableError extends AiddError {
  constructor(
    readonly code: ManifestUnavailableCode,
    options?: ErrorOptions
  ) {
    super(MANIFEST_UNAVAILABLE_MESSAGE[code], options);
    this.name = "ManifestUnavailableError";
  }
}

export class MissingPluginMetadataError extends AiddError {
  readonly code = "missing-plugin-metadata";
  constructor() {
    super("Cannot register github marketplace plugin: catalog entry is missing plugin metadata.");
    this.name = "MissingPluginMetadataError";
  }
}

export class PluginNotFoundError extends AiddError {
  readonly code = "plugin-not-found";
  constructor(name: string) {
    super(`Plugin '${name}' is not installed.`);
    this.name = "PluginNotFoundError";
  }
}

export class ProjectScopeUnsupportedError extends AiddError {
  readonly code = "cursor-project-scope-unsupported";
  constructor() {
    super(
      "Cursor plugins only support user-scope install (~/.cursor/plugins/local/). Project-scope is not auto-loaded by Cursor."
    );
    this.name = "ProjectScopeUnsupportedError";
  }
}

export class ToolNotInstalledError extends AiddError {
  readonly code = "tool-not-installed";
  constructor(toolId: string, context?: string) {
    super(context ? `${context} '${toolId}' is not installed.` : `${toolId} is not installed`);
    this.name = "ToolNotInstalledError";
  }
}

export class UnresolvableUserScopeError extends AiddError {
  readonly code = "unresolvable-user-scope";
  constructor(toolId: string) {
    super(
      `Manifest records a user-scope plugin for "${toolId}", but this tool's profile declares no user-scope plugins directory. Refusing to guess a base directory rather than silently resolving under the project root.`
    );
    this.name = "UnresolvableUserScopeError";
  }
}
