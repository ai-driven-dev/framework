import { describe, expect, it } from "vitest";
import { InspectUserScopeFiles } from "../../../../../src/contexts/installation/application/clean/inspect-user-scope-files.use-case.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";
import { aUserPlugin, heldBy, userScopeParts } from "../../testing/user-scope-purge.builder.js";

function fixture(options: Parameters<typeof userScopeParts>[0] = {}) {
  const { deps, tools } = userScopeParts(options);
  const { userManifestRepo, claims, purgeMachineState } = deps;
  return {
    inspect: new InspectUserScopeFiles({ userManifestRepo, claims, purgeMachineState }, tools),
  };
}

describe("inspecting the machine's user-scope files", () => {
  it("reports the manifest's tools, the user plugin dependents, the built versions and the referencing projects", async () => {
    const manifest = aManifest()
      .withTool(TOOL.claude, [])
      .withPlugin(TOOL.claude, aUserPlugin())
      .build();
    const records = new Map([
      [
        TOOL.claude,
        {
          pluginClaims: [
            heldBy(["/a", "/b"]),
            { plugin: "not-in-the-manifest", dependents: ["/z"] },
            { ref: "p@c", dependents: ["/b", "/c"] },
          ],
        },
      ],
    ]);
    const { inspect } = fixture({ manifest, records });

    await expect(inspect.execute(async () => ["/p"])).resolves.toEqual({
      manifestFound: true,
      toolIds: [TOOL.claude],
      activePluginDependents: ["/a", "/b", "/c"],
      builtVersions: ["1.0.0"],
      referencingProjects: ["/p"],
    });
  });

  it("reports no manifest found when the machine has none", async () => {
    const { inspect } = fixture({ manifest: null });

    await expect(inspect.execute(async () => [])).resolves.toMatchObject({
      manifestFound: false,
      toolIds: [],
      activePluginDependents: [],
    });
  });
});
