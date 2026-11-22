import { describe, expect, it } from "vitest";
import { InspectUserScope } from "../../../../../src/contexts/installation/application/clean/inspect-user-scope.use-case.js";
import { ProveUserScopeWithdrawals } from "../../../../../src/contexts/installation/application/clean/prove-user-scope-withdrawals.js";
import { PurgeUserScopeFiles } from "../../../../../src/contexts/installation/application/clean/purge-user-scope-files.js";
import { PurgeUserScopeMachine } from "../../../../../src/contexts/installation/application/clean/purge-user-scope-machine.js";
import { userScopeParts } from "../../testing/user-scope-purge.builder.js";

const ROOT = "/project";

function fixture() {
  const { deps, tools, ...doubles } = userScopeParts();
  const { userManifestRepo, claims, purgeMachineState, homeDir, userScopePluginFiles } = deps;
  const purge = new PurgeUserScopeFiles({
    userManifestRepo,
    inspection: new InspectUserScope({ userManifestRepo, claims, purgeMachineState }, tools),
    withdrawals: new ProveUserScopeWithdrawals(
      { userManifestRepo, claims, homeDir, userScopePluginFiles },
      tools
    ),
    machinePurge: new PurgeUserScopeMachine(
      { userManifestRepo, purgeMachineState, homeDir, userScopePluginFiles },
      tools
    ),
  });
  return { ...doubles, purge };
}

describe("PurgeUserScopeFiles", () => {
  it("purges the proven plugin files and the machine state, keeping the manifest", async () => {
    const { repo, files, machine, purge } = fixture();

    await purge.purge(ROOT);

    expect(files.removed.map((removed) => [...removed.keys()])).toEqual([["a.md", "b.md"]]);
    expect(machine.purgeCount).toBe(1);
    expect(repo.getCurrent()).not.toBeNull();
  });

  it("deletes the user manifest", async () => {
    const { repo, purge } = fixture();

    await purge.deleteManifest();

    expect(repo.getCurrent()).toBeNull();
  });

  it("runs an action holding the manifest's lock and answers its result", async () => {
    await expect(fixture().purge.exclusive(async () => 7)).resolves.toBe(7);
  });
});
