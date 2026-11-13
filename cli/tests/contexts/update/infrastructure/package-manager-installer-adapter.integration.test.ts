import { afterEach, describe, expect, it } from "vitest";
import { PackageManagerInstallerAdapter } from "../../../../src/contexts/update/infrastructure/package-manager-installer-adapter.js";
import { UpdateError } from "../../../../src/kernel/errors.js";
import { aStubMachine, type StubMachine } from "../testing/stub-package-managers.js";

describe.skipIf(process.platform === "win32")(
  "PackageManagerInstallerAdapter over stub binaries",
  () => {
    let machine: StubMachine;

    afterEach(() => machine.dispose());

    it.each([
      ["linux", "which"],
      ["win32", "where"],
    ] as const)("looks the binary up with the command of %s", async (platform, lookup) => {
      machine = await aStubMachine({ lookup, found: "/usr/local/bin/aidd\n", stderr: null });

      expect(new PackageManagerInstallerAdapter(machine.env, platform).install()).toBe(
        "/usr/local/bin/aidd"
      );
    });

    it("answers the first binary of a listing separated by CRLF", async () => {
      machine = await aStubMachine({
        lookup: "where",
        found: "/usr/local/bin/aidd\r\n/opt/other/aidd\r\n",
        stderr: null,
      });

      expect(new PackageManagerInstallerAdapter(machine.env, "win32").install()).toBe(
        "/usr/local/bin/aidd"
      );
    });

    it("echoes the failed install's stderr once, then refuses", async () => {
      machine = await aStubMachine({
        lookup: "which",
        found: "/usr/local/bin/aidd\n",
        stderr: "npm error 403",
      });

      expect(() => new PackageManagerInstallerAdapter(machine.env, "linux").install()).toThrow(
        new UpdateError()
      );
      expect(machine.stderrEchoed()).toStrictEqual(["npm error 403\n"]);
    });
  }
);
