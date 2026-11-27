import { chmod, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createSandbox,
  type HostSandbox,
  hostVersion,
  writeMarketplace,
} from "../../../../scripts/host-recording.mjs";
import { NativePluginCliError } from "../../../../src/contexts/host-registration/contract/host-registration.error.js";
import { HostCliAdapter } from "../../../../src/contexts/host-registration/infrastructure/host-cli-adapter.js";
import type { HostCliShape } from "../../../../src/contexts/host-registration/ports/host-cli-shape.js";
import { FakeHostActions } from "../../../shared/testing/fake-host-actions.fake.js";
import {
  describeHostActionsContract,
  type HostActionsScenario,
  type HostActionsSubject,
} from "../testing/host-actions.contract.js";
import { scratchDirectory } from "../testing/scratch-directory.builder.js";

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
 * The adapter runs `.cmd` launchers through a shell on Windows, but the repository fakes binaries
 * with `#!/bin/sh` only. */
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

/** The real host binaries, in a throwaway HOME over a local marketplace and no model. Opt in with
 * `AIDD_HOST_CONTRACT=1`, never in pre-commit; a host that is not installed is skipped. Each shape
 * is what that host's profile declares. */
const REAL_HOSTS: readonly {
  host: "claude" | "codex" | "copilot";
  marketplace: string;
  shape: HostCliShape;
}[] = [
  {
    host: "claude",
    marketplace: "mk-one",
    shape: {
      scopeArgs: { project: ["--scope", "local"], user: ["--scope", "user"] },
      userRemoveArgs: [],
      enableVerb: "install",
      disableVerb: "uninstall",
      upgradeVerb: "update",
      pluginArgs: ["--yes"],
    },
  },
  {
    host: "codex",
    marketplace: "cx-one",
    shape: { enableVerb: "add", disableVerb: "remove" },
  },
  {
    host: "copilot",
    marketplace: "mk-one",
    shape: {
      upgradeVerb: "update",
      enableVerb: "install",
      disableVerb: "uninstall",
      forceRemoveArgs: ["--force"],
    },
  },
];

const SANDBOX_ENV = ["HOME", "CODEX_HOME", "COPILOT_HOME", "XDG_CONFIG_HOME"] as const;

describe.skipIf(process.platform === "win32" || process.env.AIDD_HOST_CONTRACT !== "1")(
  "HostCliAdapter over the real host binaries",
  () => {
    let sandbox: HostSandbox;
    let previous: Record<string, string | undefined>;

    beforeEach(() => {
      sandbox = createSandbox();
      previous = Object.fromEntries(SANDBOX_ENV.map((key) => [key, process.env[key]]));
      for (const key of SANDBOX_ENV) process.env[key] = sandbox.env[key];
    });

    afterEach(() => {
      for (const key of SANDBOX_ENV) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
      sandbox.dispose();
    });

    for (const { host, marketplace, shape } of REAL_HOSTS) {
      describe.skipIf(hostVersion(host) === undefined)(host, () => {
        const ref = `p@${marketplace}`;
        const timeout = 120000;

        it(
          "takes every call an accepting host is given",
          () => {
            const source = join(sandbox.markets, "a");
            writeMarketplace(host, source);
            const actions = new HostCliAdapter(host, shape);

            expect(actions.isAvailable()).toBe(true);
            expect(() => {
              actions.addMarketplace(source, "user");
              actions.enablePlugin(ref, "user");
              actions.uninstallPlugin(ref, "user");
              actions.upgradeMarketplaces(marketplace);
              actions.removeMarketplace(marketplace, "user");
            }).not.toThrow();
          },
          timeout
        );

        it(
          "fails with the typed error when asked to remove a marketplace it does not hold",
          () => {
            expect(() =>
              new HostCliAdapter(host, shape).removeMarketplace("nosuch", "user")
            ).toThrow(NativePluginCliError);
          },
          timeout
        );
      });
    }
  }
);
