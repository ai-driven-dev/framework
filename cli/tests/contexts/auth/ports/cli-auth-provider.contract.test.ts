import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe } from "vitest";
import { GhCliAdapter } from "../../../../src/contexts/auth/infrastructure/gh-cli-adapter.js";
import {
  type CliScenario,
  type CliSubject,
  describeCliAuthProviderContract,
} from "../testing/cli-auth-provider-contract.js";
import { FakeCliAuthProvider } from "../testing/fake-cli-auth-provider.js";

describeCliAuthProviderContract(
  "the fake",
  async (scenario: CliScenario): Promise<CliSubject> => ({
    provider: new FakeCliAuthProvider(
      scenario.kind === "signed-in"
        ? { token: scenario.token, login: scenario.login }
        : scenario.kind === "failing"
          ? { readFailure: new Error("the tool failed") }
          : {}
    ),
    dispose: async () => undefined,
  })
);

/** What `gh` prints for each scenario. */
function ghScript(scenario: CliScenario): string | undefined {
  if (scenario.kind === "absent") return undefined;
  if (scenario.kind === "failing") return "#!/bin/sh\necho 'gh: something broke' >&2\nexit 1\n";
  return `#!/bin/sh\ncase "$1" in auth) echo ${scenario.token};; api) echo ${scenario.login};; esac\n`;
}

/** A directory that is the whole `PATH` while the subject lives: `gh` is a script there, or
 * nothing is, which is a machine without `gh`. `spawnSync` resolves no `.cmd`, and the
 * repository fakes binaries with `#!/bin/sh` only, so Windows runs the fake arm alone. */
describe.skipIf(process.platform === "win32")("on a POSIX machine", () => {
  describeCliAuthProviderContract(
    "GhCliAdapter over a fake gh",
    async (scenario: CliScenario): Promise<CliSubject> => {
      const dir = await mkdtemp(join(tmpdir(), "aidd-auth-gh-"));
      const script = ghScript(scenario);
      if (script !== undefined) await writeFile(join(dir, "gh"), script, { mode: 0o755 });
      const previous = process.env.PATH;
      process.env.PATH = dir;
      return {
        provider: new GhCliAdapter(),
        dispose: async () => {
          process.env.PATH = previous;
          await rm(dir, { recursive: true, force: true });
        },
      };
    }
  );
});
