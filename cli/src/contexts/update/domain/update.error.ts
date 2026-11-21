import { AiddError } from "../../../shared/domain/shared.error.js";

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

export class FrameworkResolutionError extends AiddError {
  readonly code = "framework-resolution";
  constructor(message: string) {
    super(message);
    this.name = "FrameworkResolutionError";
  }
}

export class PackageManagerDetectionError extends AiddError {
  readonly code = "package-manager-detection";
  constructor(commands: readonly string[]) {
    super(`Could not detect package manager. Run manually:\n  ${commands.join("\n  ")}`);
    this.name = "PackageManagerDetectionError";
  }
}

export class UpdateError extends AiddError {
  readonly code = "update";
  constructor() {
    super(
      "Update failed. If you saw a 403 error above, ensure your GitHub token includes both repo and read:packages scopes.\n" +
        "Update your token at https://github.com/settings/tokens, then re-run `aidd auth login`."
    );
    this.name = "UpdateError";
  }
}
