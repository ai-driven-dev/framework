import { afterEach, beforeEach, describe } from "vitest";
import type { PluginServerSpec } from "../../../../../src/contexts/host-registration/contract/native-registration-spec.js";
import { PluginServerAdapter } from "../../../../../src/contexts/host-registration/infrastructure/server/plugin-server-adapter.js";
import { FakeHostPluginServer } from "../../../../shared/testing/fake-host-plugin-server.fake.js";
import {
  describePluginServerContract,
  type PluginServerScenario,
  type PluginServerSubject,
} from "../../testing/plugin-server.contract.js";
import { isRunning, writeReplayHost } from "../../testing/replay-plugin-server.builder.js";
import { scratchDirectory } from "../../testing/scratch-directory.builder.js";

describePluginServerContract(
  "the fake",
  async (scenario: PluginServerScenario): Promise<PluginServerSubject> => {
    const server = new FakeHostPluginServer({
      available: scenario !== "absent",
      refusing: scenario === "refusing",
    });
    return {
      server,
      stopped: async () => server.sessionsOpened === server.sessionsClosed,
      dispose: async () => undefined,
    };
  }
);

/** What the declaration of a host with a plugin server holds, here for a host that prints the
 * banner of the recording. */
const SPEC: PluginServerSpec = {
  binary: "probe-host",
  args: ["web", "--no-open", "--port", "0"],
  bannerPattern: "Local:\\s+(\\S+?)/?#token=(\\S+)",
  pluginsPath: "/api/v1/plugins",
  notInstalledCode: 40419,
};

/** The host is a script on a `PATH` that holds nothing else, serving what was recorded. The
 * repository fakes binaries with scripts only, which Windows does not run. */
describe.skipIf(process.platform === "win32")("on a POSIX machine", () => {
  let previousPath: string | undefined;

  beforeEach(() => {
    previousPath = process.env.PATH;
  });

  afterEach(() => {
    process.env.PATH = previousPath;
  });

  describePluginServerContract(
    "PluginServerAdapter over a host replaying what was recorded",
    async (scenario: PluginServerScenario): Promise<PluginServerSubject> => {
      const scratch = await scratchDirectory();
      const host =
        scenario === "absent"
          ? undefined
          : await writeReplayHost(scratch.dir, { refusing: scenario === "refusing" });
      process.env.PATH = scratch.dir;
      return {
        server: new PluginServerAdapter(SPEC),
        stopped: async () => (await host?.pids())?.every((pid) => !isRunning(pid)) ?? true,
        dispose: scratch.dispose,
      };
    }
  );
});
