import { describe, expect, it } from "vitest";
import {
  ActiveMachineDependentsError,
  AiddFilesDetectedError,
  AlreadyInitializedError,
  DuplicatePluginError,
  InvalidManifestDataError,
  InvalidManifestToolIdError,
  InvalidPluginNameError,
  InvalidPluginScopeError,
  InvalidPluginVersionError,
  MalformedPluginScopeError,
  ManifestUnavailableError,
  MissingPluginMetadataError,
  PluginNotFoundError,
  ProjectScopeUnsupportedError,
  ToolNotInstalledError,
  UnresolvableUserScopeError,
} from "../../../../src/contexts/installation/domain/installation.error.js";

describe("ActiveMachineDependentsError", () => {
  it("says exactly what went wrong", () => {
    const error = new ActiveMachineDependentsError("x", ["a", "b"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ActiveMachineDependentsError",
      message: "Cannot remove x: active projects still depend on it: a, b.",
    });
  });

  it("carries its stable code", () => {
    expect(new ActiveMachineDependentsError("x", ["a", "b"]).code).toBe(
      "active-machine-dependents"
    );
  });
});

describe("AiddFilesDetectedError", () => {
  it("includes setup hint in message", () => {
    const error = new AiddFilesDetectedError();
    expect(error.message).toContain("AIDD files detected but no manifest found");
    expect(error.message).toContain("aidd setup");
    expect(error.name).toBe("AiddFilesDetectedError");
  });

  it("says exactly what went wrong", () => {
    const error = new AiddFilesDetectedError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "AiddFilesDetectedError",
      message:
        "AIDD files detected but no manifest found.\nRun `aidd setup` to register existing files.",
    });
  });

  it("carries its stable code", () => {
    expect(new AiddFilesDetectedError().code).toBe("aidd-files-detected");
  });
});

describe("AlreadyInitializedError", () => {
  it("has default message when no argument provided", () => {
    const error = new AlreadyInitializedError();
    expect(error.name).toBe("AlreadyInitializedError");
    expect(error.message).toContain("Already initialized");
  });

  it("uses provided message when given", () => {
    const error = new AlreadyInitializedError("Custom message here.");
    expect(error.message).toBe("Custom message here.");
  });

  it("says exactly what went wrong", () => {
    const error = new AlreadyInitializedError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "AlreadyInitializedError",
      message: "Already initialized. Use `aidd update` to upgrade.",
    });
  });

  it("carries its stable code", () => {
    expect(new AlreadyInitializedError().code).toBe("already-initialized");
  });
});

describe("DuplicatePluginError", () => {
  it("says exactly what went wrong", () => {
    const error = new DuplicatePluginError("aidd-dev");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "DuplicatePluginError",
      message: "Plugin 'aidd-dev' is already installed.",
    });
  });

  it("carries its stable code", () => {
    expect(new DuplicatePluginError("aidd-dev").code).toBe("duplicate-plugin");
  });
});

describe("InvalidManifestDataError", () => {
  it("says exactly what went wrong (1)", () => {
    const error = new InvalidManifestDataError("version missing");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidManifestDataError",
      message: "Invalid manifest data: version missing",
    });
  });

  it("says exactly what went wrong (2)", () => {
    const error = new InvalidManifestDataError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidManifestDataError",
      message: "Invalid manifest data.",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidManifestDataError("version missing").code).toBe("invalid-manifest-data");
  });
});

describe("InvalidManifestToolIdError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidManifestToolIdError("zed");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidManifestToolIdError",
      message: "Invalid tool id in manifest: 'zed'.",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidManifestToolIdError("zed").code).toBe("invalid-manifest-tool-id");
  });
});

describe("InvalidPluginNameError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidPluginNameError("My Plugin");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidPluginNameError",
      message:
        'Invalid plugin name: "My Plugin". Use lowercase alphanumeric characters and hyphens only.',
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidPluginNameError("My Plugin").code).toBe("invalid-plugin-name");
  });
});

describe("InvalidPluginScopeError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidPluginScopeError("cursor", "project", "user");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidPluginScopeError",
      message:
        "Tool 'cursor' does not support scope 'project'. Supported scope: 'user'. Re-run with --scope user or omit the flag.",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidPluginScopeError("cursor", "project", "user").code).toBe(
      "invalid-plugin-scope"
    );
  });
});

describe("InvalidPluginVersionError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidPluginVersionError("latest");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidPluginVersionError",
      message: 'Invalid plugin version: "latest". Expected semver format (e.g. 1.0.0).',
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidPluginVersionError("latest").code).toBe("invalid-plugin-version");
  });
});

describe("MalformedPluginScopeError", () => {
  it("says exactly what went wrong", () => {
    const error = new MalformedPluginScopeError("aidd-dev", "global");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "MalformedPluginScopeError",
      message:
        'Plugin "aidd-dev" carries an invalid scope: "global". Expected "project" or "user".',
    });
  });

  it("carries its stable code", () => {
    expect(new MalformedPluginScopeError("aidd-dev", "global").code).toBe("malformed-plugin-scope");
  });
});

describe("ManifestUnavailableError", () => {
  it("carries its stable code and name", () => {
    const error = new ManifestUnavailableError("manifest-missing");
    expect(error.code).toBe("manifest-missing");
    expect(error.name).toBe("ManifestUnavailableError");
  });

  it("carries the corrupted code", () => {
    expect(new ManifestUnavailableError("manifest-corrupted").code).toBe("manifest-corrupted");
  });

  it("says exactly what went wrong (1)", () => {
    const error = new ManifestUnavailableError("manifest-missing");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ManifestUnavailableError",
      message: "No AIDD manifest found. Run `aidd setup` to initialize your project.",
    });
  });

  it("says exactly what went wrong (2)", () => {
    const error = new ManifestUnavailableError("manifest-corrupted");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ManifestUnavailableError",
      message: "Manifest is corrupted (invalid JSON). Run `aidd clean --force` and re-initialize.",
    });
  });
});

describe("MissingPluginMetadataError", () => {
  it("says exactly what went wrong", () => {
    const error = new MissingPluginMetadataError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "MissingPluginMetadataError",
      message:
        "Cannot register github marketplace plugin: catalog entry is missing plugin metadata.",
    });
  });

  it("carries its stable code", () => {
    expect(new MissingPluginMetadataError().code).toBe("missing-plugin-metadata");
  });
});

describe("PluginNotFoundError", () => {
  it("says exactly what went wrong", () => {
    const error = new PluginNotFoundError("aidd-dev");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "PluginNotFoundError",
      message: "Plugin 'aidd-dev' is not installed.",
    });
  });

  it("carries its stable code", () => {
    expect(new PluginNotFoundError("aidd-dev").code).toBe("plugin-not-found");
  });
});

describe("ProjectScopeUnsupportedError", () => {
  it("says exactly what went wrong", () => {
    const error = new ProjectScopeUnsupportedError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ProjectScopeUnsupportedError",
      message:
        "Cursor plugins only support user-scope install (~/.cursor/plugins/local/). Project-scope is not auto-loaded by Cursor.",
    });
  });

  it("carries its stable code", () => {
    expect(new ProjectScopeUnsupportedError().code).toBe("cursor-project-scope-unsupported");
  });
});

describe("ToolNotInstalledError", () => {
  it("includes tool ID in message without context", () => {
    const error = new ToolNotInstalledError("claude");
    expect(error.name).toBe("ToolNotInstalledError");
    expect(error.message).toContain("claude");
  });

  it("includes context and tool ID when context is provided", () => {
    const error = new ToolNotInstalledError("cursor", "The target tool");
    expect(error.message).toContain("cursor");
    expect(error.message).toContain("The target tool");
  });

  it("says exactly what went wrong (1)", () => {
    const error = new ToolNotInstalledError("claude");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ToolNotInstalledError",
      message: "claude is not installed",
    });
  });

  it("says exactly what went wrong (2)", () => {
    const error = new ToolNotInstalledError("cursor", "The target tool");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ToolNotInstalledError",
      message: "The target tool 'cursor' is not installed.",
    });
  });

  it("carries its stable code", () => {
    expect(new ToolNotInstalledError("claude").code).toBe("tool-not-installed");
  });
});

describe("UnresolvableUserScopeError", () => {
  it("says exactly what went wrong", () => {
    const error = new UnresolvableUserScopeError("cursor");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UnresolvableUserScopeError",
      message:
        'Manifest records a user-scope plugin for "cursor", but this tool\'s profile declares no user-scope plugins directory. Refusing to guess a base directory rather than silently resolving under the project root.',
    });
  });

  it("carries its stable code", () => {
    expect(new UnresolvableUserScopeError("cursor").code).toBe("unresolvable-user-scope");
  });
});
