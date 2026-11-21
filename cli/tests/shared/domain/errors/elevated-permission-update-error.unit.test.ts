import { describe, expect, it } from "vitest";
import { ElevatedPermissionUpdateError } from "../../../../src/shared/domain/errors/elevated-permission-update-error.js";

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
