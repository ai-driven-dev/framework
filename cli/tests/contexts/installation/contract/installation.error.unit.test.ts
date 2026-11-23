import { describe, expect, it } from "vitest";
import {
  ActiveMachineDependentsError,
  AiddFilesDetectedError,
  AlreadyInitializedError,
  DuplicatePluginError,
  InvalidManifestDataError,
  InvalidManifestToolIdError,
  InvalidPluginScopeError,
  MalformedPluginScopeError,
  ManifestUnavailableError,
  MissingPluginMetadataError,
  PluginNotFoundError,
  ProjectScopeUnsupportedError,
  ToolNotInstalledError,
  UnresolvableUserScopeError,
} from "../../../../src/contexts/installation/contract/installation.error.js";

describe("an installation error carries its data and says nothing itself", () => {
  it.each([
    [
      new ActiveMachineDependentsError("x", ["a", "b"]),
      { target: "x", projects: ["a", "b"] },
      "active-machine-dependents",
    ],
    [new AiddFilesDetectedError(), {}, "aidd-files-detected"],
    [
      new AlreadyInitializedError("clean-then-setup"),
      { remedy: "clean-then-setup" },
      "already-initialized",
    ],
    [new DuplicatePluginError("aidd-dev"), { pluginName: "aidd-dev" }, "duplicate-plugin"],
    [new InvalidManifestDataError("bad"), { detail: "bad" }, "invalid-manifest-data"],
    [new InvalidManifestToolIdError("zed"), { key: "zed" }, "invalid-manifest-tool-id"],
    [
      new InvalidPluginScopeError("cursor", "project", "user"),
      { toolId: "cursor", requested: "project", supported: "user" },
      "invalid-plugin-scope",
    ],
    [
      new MalformedPluginScopeError("aidd-dev", "global"),
      { pluginName: "aidd-dev", scope: "global" },
      "malformed-plugin-scope",
    ],
    [new ManifestUnavailableError("manifest-missing"), {}, "manifest-missing"],
    [new ManifestUnavailableError("manifest-corrupted"), {}, "manifest-corrupted"],
    [new MissingPluginMetadataError(), {}, "missing-plugin-metadata"],
    [new PluginNotFoundError("aidd-dev"), { pluginName: "aidd-dev" }, "plugin-not-found"],
    [new ProjectScopeUnsupportedError(), {}, "cursor-project-scope-unsupported"],
    [
      new ToolNotInstalledError("cursor", "The target tool"),
      { toolId: "cursor", context: "The target tool" },
      "tool-not-installed",
    ],
    [new UnresolvableUserScopeError("cursor"), { toolId: "cursor" }, "unresolvable-user-scope"],
  ])("%s", (error, data, code) => {
    expect(error).toMatchObject({ ...data, message: "", code });
    expect(error.name).toBe(error.constructor.name);
  });

  it("keeps the cause a manifest refusal was raised from", () => {
    const cause = new Error("bad json");

    expect(new ManifestUnavailableError("manifest-corrupted", { cause }).cause).toBe(cause);
  });
});
