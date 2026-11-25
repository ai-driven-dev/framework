import { GhCliAdapter } from "../../../../src/contexts/auth/infrastructure/gh-cli-adapter.js";
import {
  type CliScenario,
  type CliSubject,
  describeCliAuthProviderContract,
} from "../testing/cli-auth-provider.contract.js";
import { FakeCliAuthProvider } from "../testing/fake-cli-auth-provider.fake.js";
import { aMachineWith, type StubBehaviour } from "../testing/stub-binary.builder.js";

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

/** What `gh` does for each scenario; a machine without `gh` has no command at all. */
function ghBehaviour(scenario: CliScenario): StubBehaviour | null {
  if (scenario.kind === "absent") return null;
  if (scenario.kind === "failing") return { status: 1, stderr: "gh: something broke\n" };
  return { stdoutByCommand: { auth: `${scenario.token}\n`, api: `${scenario.login}\n` } };
}

describeCliAuthProviderContract(
  "GhCliAdapter over a stub gh",
  async (scenario: CliScenario): Promise<CliSubject> => {
    const machine = await aMachineWith("gh", ghBehaviour(scenario));
    return { provider: new GhCliAdapter(), dispose: () => machine.dispose() };
  }
);
