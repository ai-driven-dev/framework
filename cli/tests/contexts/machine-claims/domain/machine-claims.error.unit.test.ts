import { describe, expect, it } from "vitest";
import {
  EditedAfterInstallError,
  NoUserPluginsDirectoryError,
  PluginDirectoryDisappearedError,
  PluginDirectoryOutsideBoundaryError,
  UnprovenInstallDigestError,
  UpdateParentEscapesBoundaryError,
  UpdatePathEscapesPluginError,
  UserManifestBusyError,
} from "../../../../src/contexts/machine-claims/domain/machine-claims.error.js";

describe("machine-claims errors", () => {
  it.each([
    [new UnprovenInstallDigestError("claude", "p", "a.md"), "unproven-install-digest"],
    [new EditedAfterInstallError("claude", "p", "a.md"), "edited-after-install"],
    [new NoUserPluginsDirectoryError("claude"), "no-user-plugins-directory"],
    [
      new PluginDirectoryOutsideBoundaryError("claude", "p", "/base"),
      "plugin-directory-outside-boundary",
    ],
    [new UpdatePathEscapesPluginError("claude", "p", "../x"), "update-path-escapes-plugin"],
    [
      new UpdateParentEscapesBoundaryError("claude", "p", "/out", "/base"),
      "update-parent-escapes-boundary",
    ],
    [new PluginDirectoryDisappearedError("claude", "p"), "plugin-directory-disappeared"],
    [new UserManifestBusyError("/m.lock"), "user-manifest-busy"],
  ])("%s carries its code and says nothing itself", (error, code) => {
    expect({ code: error.code, message: error.message }).toStrictEqual({ code, message: "" });
  });
});
