import { execSync } from "node:child_process";
import {
  ElevatedPermissionUpdateError,
  PackageManagerDetectionError,
  UpdateError,
} from "../../../shared/domain/errors.js";
import { INSTALL_COMMANDS, packageManagerOf } from "../domain/package-manager.js";
import type { CliInstaller } from "../ports/cli-installer.js";

/** Runs the package manager that owns the `aidd` found on the path. Everything it spawns
 * resolves through `env`, which is how a test keeps a real manager out of reach. */
export class PackageManagerInstallerAdapter implements CliInstaller {
  constructor(
    private readonly env: NodeJS.ProcessEnv,
    private readonly platform: NodeJS.Platform
  ) {}

  install(): string {
    const binaryPath = this.locateBinary();
    const command = INSTALL_COMMANDS[packageManagerOf(binaryPath)];
    try {
      // stderr piped (not inherited) so EPERM/EACCES can be classified;
      // captured stderr is echoed back to the user before throwing.
      execSync(command, { env: this.env, stdio: ["inherit", "inherit", "pipe"] });
    } catch (err) {
      const stderr = extractStderr(err);
      if (stderr.length > 0) process.stderr.write(stderr);
      if (isPermissionFailure(stderr)) throw new ElevatedPermissionUpdateError(command);
      throw new UpdateError();
    }
    return binaryPath;
  }

  private locateBinary(): string {
    const whichCommand = this.platform === "win32" ? "where aidd" : "which aidd";
    try {
      return firstBinaryPath(execSync(whichCommand, { env: this.env, encoding: "utf8" }));
    } catch {
      throw new PackageManagerDetectionError(Object.values(INSTALL_COMMANDS));
    }
  }
}

// Observed: a failed `execSync` carries `stderr` as a Buffer, the pipe being binary. A string,
// or no stderr at all, was never seen.
function extractStderr(err: unknown): string {
  const stderr =
    typeof err === "object" && err !== null ? (err as { stderr?: unknown }).stderr : null;
  return stderr instanceof Buffer ? stderr.toString("utf8") : "";
}

/** The first match a `which` or a `where` printed: `where` lists one per line, CRLF on Windows. */
function firstBinaryPath(output: string): string {
  return (output.trim().split(/\r?\n/)[0] as string).trim();
}

/** Whether what a failed install wrote to stderr says the process had no right to write where
 * it installs. */
function isPermissionFailure(stderr: string): boolean {
  return /\bEPERM\b|\bEACCES\b/.test(stderr);
}
