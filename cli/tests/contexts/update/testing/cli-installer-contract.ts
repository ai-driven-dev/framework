import { afterEach, describe, expect, it } from "vitest";
import { INSTALL_COMMANDS } from "../../../../src/contexts/update/domain/package-manager.js";
import type { CliInstaller } from "../../../../src/contexts/update/ports/cli-installer.js";
import {
  ElevatedPermissionUpdateError,
  PackageManagerDetectionError,
  UpdateError,
} from "../../../../src/shared/domain/errors.js";
import type { InstallScenario } from "./fake-cli-installer.js";

export interface InstallerSubject {
  readonly installer: CliInstaller;
  /** The package manager commands this subject ran, in order. */
  commandsRun(): Promise<string[]>;
  dispose(): Promise<void>;
}

/** What a replacer of the installed CLI promises. How the path is looked up, and what the
 * failures print, is the adapter's translation, tested there. */
export function describeCliInstallerContract(
  subjectName: string,
  makeSubject: (scenario: InstallScenario) => Promise<InstallerSubject>
): void {
  describe(`when the CLI installer is ${subjectName}`, () => {
    const opened: InstallerSubject[] = [];

    afterEach(async () => {
      for (const subject of opened.splice(0)) await subject.dispose();
    });

    async function given(scenario: InstallScenario): Promise<InstallerSubject> {
      const subject = await makeSubject(scenario);
      opened.push(subject);
      return subject;
    }

    it.each([
      ["npm", "/usr/local/bin/aidd"],
      ["pnpm", "/home/me/.local/share/pnpm/aidd"],
      ["yarn", "/home/me/.yarn/bin/aidd"],
      ["bun", "/home/me/.bun/bin/aidd"],
    ] as const)(
      "replaces the binary through %s when it sits under %s",
      async (manager, binaryPath) => {
        const subject = await given({ kind: "installs", binaryPath });

        expect(subject.installer.install()).toBe(binaryPath);
        expect(await subject.commandsRun()).toStrictEqual([INSTALL_COMMANDS[manager]]);
      }
    );

    it("refuses, running nothing, when no binary is found", async () => {
      const subject = await given({ kind: "absent" });

      expect(() => subject.installer.install()).toThrow(PackageManagerDetectionError);
      expect(await subject.commandsRun()).toStrictEqual([]);
    });

    it("asks for elevation when the install was refused permission", async () => {
      const subject = await given({ kind: "fails", stderr: "npm error code EACCES" });

      expect(() => subject.installer.install()).toThrow(ElevatedPermissionUpdateError);
    });

    it("refuses with the update error when the install fails otherwise", async () => {
      const subject = await given({ kind: "fails", stderr: "npm error 403" });

      expect(() => subject.installer.install()).toThrow(UpdateError);
    });
  });
}
