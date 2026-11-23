import { describe, expect, it } from "vitest";
import {
  ActiveMachineDependentsError,
  AiddFilesDetectedError,
  AlreadyInitializedError,
  DuplicatePluginError,
  InvalidManifestDataError,
  InvalidManifestToolIdError,
  InvalidPluginModeConfigError,
  InvalidPluginScopeError,
  InvalidSetupToolIdError,
  MalformedPluginScopeError,
  ManifestUnavailableError,
  MissingPluginMetadataError,
  PluginNotFoundError,
  ProjectScopeUnsupportedError,
  ToolNotInstalledError,
  UnresolvableUserScopeError,
  UserScopeIdeToolsError,
  UserScopeNoToolsError,
  UserScopePluginModeError,
  UserScopeUnsupportedAiToolsError,
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

describe("when the plugin mode config is invalid", () => {
  it("carries its data and says nothing itself", () => {
    const error = new InvalidPluginModeConfigError("bad mode");
    expect({ name: error.name, detail: error.detail, message: error.message }).toStrictEqual({
      name: "InvalidPluginModeConfigError",
      detail: "bad mode",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidPluginModeConfigError("bad mode").code).toBe("invalid-plugin-mode-config");
  });
});

describe("when a setup tool id is invalid", () => {
  it("carries its data and says nothing itself", () => {
    const error = new InvalidSetupToolIdError("zed", ["claude", "cursor"]);
    expect({
      name: error.name,
      id: error.id,
      validIds: error.validIds,
      message: error.message,
    }).toStrictEqual({
      name: "InvalidSetupToolIdError",
      id: "zed",
      validIds: ["claude", "cursor"],
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidSetupToolIdError("zed", ["claude", "cursor"]).code).toBe(
      "invalid-setup-tool-id"
    );
  });
});

describe("when an IDE tool is asked at user scope", () => {
  it("carries its data and says nothing itself", () => {
    const error = new UserScopeIdeToolsError(["vscode", "zed"]);
    expect({ name: error.name, ideTools: error.ideTools, message: error.message }).toStrictEqual({
      name: "UserScopeIdeToolsError",
      ideTools: ["vscode", "zed"],
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopeIdeToolsError(["vscode", "zed"]).code).toBe("user-scope-ide-tools");
  });
});

describe("when a user-scope run names no tool", () => {
  it("says nothing itself", () => {
    const error = new UserScopeNoToolsError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UserScopeNoToolsError",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopeNoToolsError().code).toBe("user-scope-no-tools");
  });
});

describe("when a user-scope run has a bad plugin mode", () => {
  it("says nothing itself", () => {
    const error = new UserScopePluginModeError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UserScopePluginModeError",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopePluginModeError().code).toBe("user-scope-plugin-mode");
  });
});

describe("when an AI tool has no user scope", () => {
  it("carries its data and says nothing itself", () => {
    const error = new UserScopeUnsupportedAiToolsError(["cursor", "opencode"]);
    expect({ name: error.name, aiTools: error.aiTools, message: error.message }).toStrictEqual({
      name: "UserScopeUnsupportedAiToolsError",
      aiTools: ["cursor", "opencode"],
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopeUnsupportedAiToolsError(["cursor", "opencode"]).code).toBe(
      "user-scope-unsupported-ai-tools"
    );
  });
});
