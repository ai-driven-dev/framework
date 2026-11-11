import { chmod, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe } from "vitest";
import { HostCliAdapter } from "../../../../src/contexts/host-registration/infrastructure/host-cli-adapter.js";
import { FakeHostActions } from "../testing/fake-host-actions.js";
import {
  describeHostActionsContract,
  type HostActionsScenario,
  type HostActionsSubject,
} from "../testing/host-actions-contract.js";
import { scratchDirectory } from "../testing/scratch-directory.js";

describeHostActionsContract(
  "the fake",
  async (scenario: HostActionsScenario): Promise<HostActionsSubject> => ({
    actions: new FakeHostActions({
      available: scenario !== "absent",
      ...(scenario === "refusing"
        ? {
            failOnPlugins: ["p@m"],
            failOnUninstall: ["p@m"],
            throwOnRemove: true,
            conflictOnAdd: true,
          }
        : {}),
    }),
    dispose: async () => undefined,
  })
);

/** The host's CLI is a script on a `PATH` that holds nothing else, never a real host binary.
 * `spawnSync` resolves no `.cmd` and the repository fakes binaries with `#!/bin/sh` only. */
describe.skipIf(process.platform === "win32")("on a POSIX machine", () => {
  let previousPath: string | undefined;

  beforeEach(() => {
    previousPath = process.env.PATH;
  });

  afterEach(() => {
    process.env.PATH = previousPath;
  });

  describeHostActionsContract(
    "HostCliAdapter over a stub binary",
    async (scenario: HostActionsScenario): Promise<HostActionsSubject> => {
      const scratch = await scratchDirectory();
      if (scenario !== "absent") {
        await writeFile(
          join(scratch.dir, "probe-host"),
          `#!/bin/sh\nexit ${scenario === "refusing" ? 1 : 0}\n`
        );
        await chmod(join(scratch.dir, "probe-host"), 0o755);
      }
      process.env.PATH = scratch.dir;
      return {
        actions: new HostCliAdapter("probe-host", {
          scopeArgs: { project: ["--scope", "local"], user: ["--scope", "user"] },
          upgradeVerb: "update",
          enableVerb: "install",
          disableVerb: "uninstall",
        }),
        dispose: scratch.dispose,
      };
    }
  );
});
