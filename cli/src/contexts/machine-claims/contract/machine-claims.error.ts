import { AiddError } from "../../../shared/domain/shared.error.js";

/** A recorded user-scope file carries no install digest that could prove it unedited. */
export class UnprovenInstallDigestError extends AiddError {
  readonly code = "unproven-install-digest";
  constructor(
    readonly toolId: string,
    readonly pluginName: string,
    readonly relativePath: string
  ) {
    super();
  }
}

/** A recorded user-scope file no longer matches the digest recorded at install. */
export class EditedAfterInstallError extends AiddError {
  readonly code = "edited-after-install";
  constructor(
    readonly toolId: string,
    readonly pluginName: string,
    readonly relativePath: string
  ) {
    super();
  }
}

/** The tool declares no user plugins directory, so no user-scope write has a boundary. */
export class NoUserPluginsDirectoryError extends AiddError {
  readonly code = "no-user-plugins-directory";
  constructor(readonly toolId: string) {
    super();
  }
}

/** The plugin directory does not resolve strictly inside the tool's user plugins directory. */
export class PluginDirectoryOutsideBoundaryError extends AiddError {
  readonly code = "plugin-directory-outside-boundary";
  constructor(
    readonly toolId: string,
    readonly pluginName: string,
    readonly boundary: string
  ) {
    super();
  }
}

/** An update path is absolute, not normalized, or outside the plugin's own directory. */
export class UpdatePathEscapesPluginError extends AiddError {
  readonly code = "update-path-escapes-plugin";
  constructor(
    readonly toolId: string,
    readonly pluginName: string,
    readonly path: string
  ) {
    super();
  }
}

/** The nearest existing parent of an updated file resolves outside the user plugins directory. */
export class UpdateParentEscapesBoundaryError extends AiddError {
  readonly code = "update-parent-escapes-boundary";
  constructor(
    readonly toolId: string,
    readonly pluginName: string,
    readonly parent: string,
    readonly boundary: string
  ) {
    super();
  }
}

/** The plugin directory vanished while an update was checking its parents. */
export class PluginDirectoryDisappearedError extends AiddError {
  readonly code = "plugin-directory-disappeared";
  constructor(
    readonly toolId: string,
    readonly pluginName: string
  ) {
    super();
  }
}

/** Another AIDD process held the machine lock past the deadline. */
export class UserManifestBusyError extends AiddError {
  readonly code = "user-manifest-busy";
  constructor(readonly lock: string) {
    super();
  }
}
