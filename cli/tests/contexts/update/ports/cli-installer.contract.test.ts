import { describe } from "vitest";
import { PackageManagerInstallerAdapter } from "../../../../src/contexts/update/infrastructure/package-manager-installer-adapter.js";
import {
  describeCliInstallerContract,
  type InstallerSubject,
} from "../testing/cli-installer-contract.js";
import { FakeCliInstaller, type InstallScenario } from "../testing/fake-cli-installer.js";
import { aStubMachine } from "../testing/stub-package-managers.js";

describeCliInstallerContract(
  "the fake",
  async (scenario: InstallScenario): Promise<InstallerSubject> => {
    const installer = new FakeCliInstaller(scenario);
    return { installer, commandsRun: async () => installer.ran, dispose: async () => undefined };
  }
);

describe.skipIf(process.platform === "win32")("on a POSIX machine", () => {
  describeCliInstallerContract(
    "PackageManagerInstallerAdapter over stub package managers",
    async (scenario: InstallScenario): Promise<InstallerSubject> => {
      const machine = await aStubMachine({
        lookup: "which",
        found:
          scenario.kind === "absent"
            ? null
            : `${scenario.kind === "installs" ? scenario.binaryPath : "/usr/local/bin/aidd"}\n`,
        stderr: scenario.kind === "fails" ? scenario.stderr : null,
      });
      return {
        installer: new PackageManagerInstallerAdapter(machine.env, "linux"),
        commandsRun: machine.commandsRun,
        dispose: machine.dispose,
      };
    }
  );
});
