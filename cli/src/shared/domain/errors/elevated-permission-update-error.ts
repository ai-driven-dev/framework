import { AiddError } from "./aidd-error.js";

export class ElevatedPermissionUpdateError extends AiddError {
  readonly code = "elevated-permission-update";
  constructor(installCommand: string) {
    super(
      "Update failed: the global package directory is not writable (EPERM/EACCES).\n" +
        "Pick one:\n" +
        "  1. Run the terminal as Administrator (Windows) or with sudo (macOS/Linux), then re-run `aidd update`.\n" +
        "  2. Move global installs to a user-writable prefix, then re-run the update:\n" +
        "     Windows:  npm config set prefix %APPDATA%\\npm\n" +
        "     macOS/Linux:  npm config set prefix ~/.npm-global\n" +
        `  3. Run the update directly: ${installCommand}`
    );
    this.name = "ElevatedPermissionUpdateError";
  }
}
