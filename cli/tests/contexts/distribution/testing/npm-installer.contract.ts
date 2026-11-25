import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { NpmInstaller } from "../../../../src/contexts/distribution/ports/npm-installer.js";

/** A package spec every subject can serve, scoped on purpose: its name holds a slash. */
export const SERVED_SPEC = "@acme/plugin@1.2.3";
export const SERVED_PACKAGE = "@acme/plugin";
/** A spec no registry behind the subject holds. */
export const UNKNOWN_SPEC = "no-such-plugin@9.9.9";

export interface NpmInstallerSubject {
  readonly installer: NpmInstaller;
  readonly prefix: string;
  dispose(): Promise<void>;
}

/** What installing an npm package under a prefix promises, whatever runs the install. */
export function describeNpmInstallerContract(
  subjectName: string,
  makeSubject: () => Promise<NpmInstallerSubject>
): void {
  describe(`when an npm package is installed ${subjectName}`, () => {
    const opened: NpmInstallerSubject[] = [];

    afterEach(async () => {
      for (const subject of opened.splice(0)) await subject.dispose();
    });

    async function given(): Promise<NpmInstallerSubject> {
      const subject = await makeSubject();
      opened.push(subject);
      return subject;
    }

    it("leaves the package under node_modules in the prefix", async () => {
      const { installer, prefix } = await given();

      await installer.install(SERVED_SPEC, prefix);

      expect(existsSync(join(prefix, "node_modules", SERVED_PACKAGE))).toBe(true);
    });

    it("rejects a package nothing serves, and leaves no node_modules behind", async () => {
      const { installer, prefix } = await given();

      await expect(installer.install(UNKNOWN_SPEC, prefix)).rejects.toThrow();

      expect(existsSync(join(prefix, "node_modules"))).toBe(false);
    });
  });
}
