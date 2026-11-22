import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ProveUserScopeWithdrawals } from "../../../../../src/contexts/installation/application/clean/prove-user-scope-withdrawals.js";
import type { RegistrationRecords } from "../../../../../src/contexts/installation/ports/record/registration-records.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";
import { USER_SCOPE_HOME, userScopeParts } from "../../testing/user-scope-purge.builder.js";

function fixture(options: Parameters<typeof userScopeParts>[0] = {}) {
  const { deps, tools } = userScopeParts(options);
  const { userManifestRepo, claims, homeDir, userScopePluginFiles } = deps;
  return {
    prove: new ProveUserScopeWithdrawals(
      { userManifestRepo, claims, homeDir, userScopePluginFiles },
      tools
    ),
  };
}

describe("ProveUserScopeWithdrawals.prove", () => {
  it("answers none when the machine has no manifest", async () => {
    await expect(fixture({ manifest: null }).prove.prove()).resolves.toEqual([]);
  });

  it("refuses while a tracked file escaped its user-scope boundary", async () => {
    const { prove } = fixture({ proven: ["a.md"] });

    await expect(prove.prove()).rejects.toThrow("User clean refused");
  });

  it("answers the host registration each tool recorded, with its claimed refs", async () => {
    const manifest = aManifest().withTool(TOOL.codex, []).build();
    const records: RegistrationRecords = new Map([
      [
        TOOL.codex,
        {
          binary: "codex",
          marketplaces: [],
          pluginRefs: ["p@c"],
          pluginClaims: [{ ref: "p@c", dependents: [] }],
        },
      ],
    ]);
    const { prove } = fixture({ manifest, records });

    const withdrawals = await prove.prove();

    expect(withdrawals.map((w) => [w.tool.toolId, w.claimedRefs])).toEqual([[TOOL.codex, ["p@c"]]]);
  });

  it("names the host plugin cache under the home it was given", async () => {
    const manifest = aManifest().withTool(TOOL.codex, []).build();
    const records: RegistrationRecords = new Map([
      [TOOL.codex, { binary: "codex", marketplaces: [], pluginRefs: [] }],
    ]);
    const { prove } = fixture({ manifest, records });

    const [withdrawal] = await prove.prove();

    expect(withdrawal?.cacheRoot).toBe(join(USER_SCOPE_HOME, ".codex", "plugins", "cache"));
  });
});
