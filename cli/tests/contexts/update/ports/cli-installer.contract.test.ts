import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { describe, expect, vi } from "vitest";
import { PackageManagerInstallerAdapter } from "../../../../src/contexts/update/infrastructure/package-manager-installer-adapter.js";
import {
  describeCliInstallerContract,
  type InstallerSubject,
} from "../testing/cli-installer-contract.js";
import { FakeCliInstaller, type InstallScenario } from "../testing/fake-cli-installer.js";

describeCliInstallerContract(
  "the fake",
  async (scenario: InstallScenario): Promise<InstallerSubject> => {
    const installer = new FakeCliInstaller(scenario);
    return { installer, commandsRun: async () => installer.ran, dispose: async () => undefined };
  }
);

const MANAGERS = ["npm", "pnpm", "yarn", "bun"];

/** Shell builtins only: the whole `PATH` is the stub directory, so `cat` is out of reach too. */
const lookup = (dir: string): string =>
  `#!/bin/sh\n[ -r "${dir}/found" ] || exit 1\nread -r line < "${dir}/found"\necho "$line"\n`;

function manager(dir: string, name: string, stderr: string | null): string {
  const failure = stderr === null ? "" : `echo "${stderr}" >&2\nexit 1\n`;
  return `#!/bin/sh\necho "${name} $*" >> "${dir}/log"\n${failure}`;
}

/** What `aidd`'s lookup and the package managers are, per scenario. They are scripts in a
 * directory that is the whole `PATH`, never a real manager. The guard below proves that before
 * anything is installed: a tool that resolved elsewhere would be a real one. */
describe.skipIf(process.platform === "win32")("on a POSIX machine", () => {
  describeCliInstallerContract(
    "PackageManagerInstallerAdapter over stub package managers",
    async (scenario: InstallScenario): Promise<InstallerSubject> => {
      const dir = await mkdtemp(join(tmpdir(), "aidd-update-installer-"));
      const write = (name: string, body: string) =>
        writeFile(join(dir, name), body, { mode: 0o755 });
      await write("which", lookup(dir));
      const stderr = scenario.kind === "fails" ? scenario.stderr : null;
      for (const name of MANAGERS) await write(name, manager(dir, name, stderr));
      if (scenario.kind !== "absent") {
        await writeFile(
          join(dir, "found"),
          scenario.kind === "installs" ? scenario.binaryPath : "/usr/local/bin/aidd"
        );
      }
      const env = { PATH: dir };
      const resolved = execFileSync(
        "/bin/sh",
        ["-c", `for tool in which ${MANAGERS.join(" ")}; do command -v "$tool"; done`],
        { env, encoding: "utf8" }
      )
        .trim()
        .split("\n");
      expect(resolved).toHaveLength(MANAGERS.length + 1);
      for (const found of resolved) expect(found.startsWith(dir + sep)).toBe(true);
      // The adapter echoes a failed install's stderr; the stubs' is not worth the run's output.
      const echo = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      return {
        installer: new PackageManagerInstallerAdapter(env, "linux"),
        commandsRun: async () =>
          (await readFile(join(dir, "log"), "utf8").catch(() => "")).split("\n").filter(Boolean),
        dispose: async () => {
          echo.mockRestore();
          await rm(dir, { recursive: true, force: true });
        },
      };
    }
  );
});
