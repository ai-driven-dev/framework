import {
  INSTALL_COMMANDS,
  packageManagerOf,
} from "../../../../src/contexts/update/domain/package-manager.js";
import type { CliInstaller } from "../../../../src/contexts/update/ports/cli-installer.js";
import {
  ElevatedPermissionUpdateError,
  PackageManagerDetectionError,
  UpdateError,
} from "../../../../src/shared/domain/errors.js";

/** What one scenario asks of an installer: the machine it runs on. */
export type InstallScenario =
  /** `aidd` sits at this path and its package manager installs the release. */
  | { kind: "installs"; binaryPath: string }
  /** No `aidd` is on the path. */
  | { kind: "absent" }
  /** The package manager fails, writing this to stderr. */
  | { kind: "fails"; stderr: string };

const DEFAULT_PATH = "/usr/local/bin/aidd";

/** An installer that runs no package manager: it keeps the command it would have run. */
export class FakeCliInstaller implements CliInstaller {
  readonly ran: string[] = [];

  constructor(
    private readonly scenario: InstallScenario = { kind: "installs", binaryPath: DEFAULT_PATH }
  ) {}

  install(): string {
    const scenario = this.scenario;
    if (scenario.kind === "absent") {
      throw new PackageManagerDetectionError(Object.values(INSTALL_COMMANDS));
    }
    const binaryPath = scenario.kind === "installs" ? scenario.binaryPath : DEFAULT_PATH;
    const command = INSTALL_COMMANDS[packageManagerOf(binaryPath)];
    this.ran.push(command);
    if (scenario.kind === "fails") {
      throw /EPERM|EACCES/.test(scenario.stderr)
        ? new ElevatedPermissionUpdateError(command)
        : new UpdateError();
    }
    return binaryPath;
  }
}
