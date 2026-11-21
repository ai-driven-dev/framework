import { describe, expect, it } from "vitest";
import {
  ElevatedPermissionUpdateError,
  FrameworkResolutionError,
  PackageManagerDetectionError,
  UpdateError,
} from "../../../../src/contexts/update/domain/update.error.js";

describe("ElevatedPermissionUpdateError", () => {
  it("says exactly what went wrong", () => {
    const error = new ElevatedPermissionUpdateError("npm install -g x@latest");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ElevatedPermissionUpdateError",
      message: [
        "Update failed: the global package directory is not writable (EPERM/EACCES).",
        "Pick one:",
        "  1. Run the terminal as Administrator (Windows) or with sudo (macOS/Linux), then re-run `aidd update`.",
        "  2. Move global installs to a user-writable prefix, then re-run the update:",
        "     Windows:  npm config set prefix %APPDATA%\\npm",
        "     macOS/Linux:  npm config set prefix ~/.npm-global",
        "  3. Run the update directly: npm install -g x@latest",
      ].join("\n"),
    });
  });

  it("carries its stable code", () => {
    expect(new ElevatedPermissionUpdateError("npm install -g x@latest").code).toBe(
      "elevated-permission-update"
    );
  });
});

describe("FrameworkResolutionError", () => {
  it("says exactly what went wrong", () => {
    const error = new FrameworkResolutionError("no framework");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "FrameworkResolutionError",
      message: "no framework",
    });
  });

  it("carries its stable code", () => {
    expect(new FrameworkResolutionError("no framework").code).toBe("framework-resolution");
  });
});

describe("PackageManagerDetectionError", () => {
  it("says exactly what went wrong", () => {
    const error = new PackageManagerDetectionError(["npm i -g x", "pnpm add -g x"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "PackageManagerDetectionError",
      message: "Could not detect package manager. Run manually:\n  npm i -g x\n  pnpm add -g x",
    });
  });

  it("carries its stable code", () => {
    expect(new PackageManagerDetectionError(["npm i -g x", "pnpm add -g x"]).code).toBe(
      "package-manager-detection"
    );
  });
});

describe("UpdateError", () => {
  it("says exactly what went wrong", () => {
    const error = new UpdateError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UpdateError",
      message:
        "Update failed. If you saw a 403 error above, ensure your GitHub token includes both repo and read:packages scopes.\nUpdate your token at https://github.com/settings/tokens, then re-run `aidd auth login`.",
    });
  });

  it("carries its stable code", () => {
    expect(new UpdateError().code).toBe("update");
  });
});
