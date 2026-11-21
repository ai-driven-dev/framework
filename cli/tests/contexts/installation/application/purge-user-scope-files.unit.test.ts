import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PurgeUserScopeFiles } from "../../../../src/contexts/installation/application/purge-user-scope-files.js";
import { ActiveMachineDependentsError } from "../../../../src/contexts/installation/domain/installation.error.js";
import { InstalledPlugin } from "../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import type { UserScopeInspection } from "../../../../src/contexts/installation/ports/user-scope-purge.js";
import { InMemoryManifestRepository } from "../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { FakeMachineStatePurge } from "../testing/fake-machine-state-purge.fake.js";
import { FakeUserScopePluginFiles } from "../testing/fake-user-scope-plugin-files.fake.js";
import { aManifest } from "../testing/manifest.builder.js";

const HOME = "/fake-home";
const ROOT = "/project";
const NAME = "aidd-dev";

function userPlugin(dependents: string[] = []) {
  return InstalledPlugin.fromJSON({
    name: NAME,
    source: { kind: "local", path: "/fixture" },
    version: "1.0.0",
    strict: false,
    files: { "a.md": "h1", "b.md": "h2" },
    scope: "user",
    dependents,
  });
}

function fixture(
  options: {
    manifest?: ReturnType<ReturnType<typeof aManifest>["build"]> | null;
    proven?: string[];
  } = {}
) {
  const manifest =
    options.manifest === undefined
      ? aManifest().withTool(TOOL.claude, []).withPlugin(TOOL.claude, userPlugin()).build()
      : options.manifest;
  const repo = new InMemoryManifestRepository(manifest);
  const files = new FakeUserScopePluginFiles(
    new Map([[NAME, new Map((options.proven ?? ["a.md", "b.md"]).map((f) => [f, "h"]))]])
  );
  const machine = new FakeMachineStatePurge(["1.0.0"]);
  const purge = new PurgeUserScopeFiles(repo, machine, () => HOME, files, registeredTools());
  return { repo, files, machine, purge };
}

describe("PurgeUserScopeFiles.inspect", () => {
  it("reports the manifest's tools, the user plugin dependents, the built versions and the referencing projects", async () => {
    const manifest = aManifest()
      .withTool(TOOL.claude, [])
      .withPlugin(TOOL.claude, userPlugin(["/a", "/b"]))
      .build();
    const { purge } = fixture({ manifest });

    await expect(purge.inspect(async () => ["/p"])).resolves.toEqual({
      manifestFound: true,
      toolIds: [TOOL.claude],
      activePluginDependents: ["/a", "/b"],
      builtVersions: ["1.0.0"],
      referencingProjects: ["/p"],
    });
  });

  it("reports no manifest found when the machine has none", async () => {
    const { purge } = fixture({ manifest: null });

    await expect(purge.inspect(async () => [])).resolves.toMatchObject({
      manifestFound: false,
      toolIds: [],
      activePluginDependents: [],
    });
  });
});

describe("PurgeUserScopeFiles.proveWithdrawals", () => {
  it("answers none when the machine has no manifest", async () => {
    await expect(fixture({ manifest: null }).purge.proveWithdrawals()).resolves.toEqual([]);
  });

  it("refuses while a tracked file escaped its user-scope boundary", async () => {
    const { purge } = fixture({ proven: ["a.md"] });

    await expect(purge.proveWithdrawals()).rejects.toThrow("User clean refused");
  });

  it("answers the host registration each tool recorded, with its claimed refs", async () => {
    const manifest = aManifest().withTool(TOOL.codex, []).build();
    manifest.setNativeRegistrations(TOOL.codex, {
      binary: "codex",
      marketplaces: [],
      pluginRefs: ["p@c"],
      pluginClaims: [{ ref: "p@c", dependents: [] }],
    });
    const { purge } = fixture({ manifest });

    const withdrawals = await purge.proveWithdrawals();

    expect(withdrawals.map((w) => [w.tool.toolId, w.claimedRefs])).toEqual([[TOOL.codex, ["p@c"]]]);
  });

  it("names the host plugin cache under the home it was given", async () => {
    const manifest = aManifest().withTool(TOOL.codex, []).build();
    manifest.setNativeRegistrations(TOOL.codex, {
      binary: "codex",
      marketplaces: [],
      pluginRefs: [],
    });
    const { purge } = fixture({ manifest });

    const [withdrawal] = await purge.proveWithdrawals();

    expect(withdrawal?.cacheRoot).toBe(join(HOME, ".codex", "plugins", "cache"));
  });
});

describe("PurgeUserScopeFiles.purge", () => {
  it("removes the proven plugin files, purges the machine state, then deletes the manifest", async () => {
    const { repo, files, machine, purge } = fixture();

    await purge.purge(ROOT);

    expect(files.removed.map((removed) => [...removed.keys()])).toEqual([["a.md", "b.md"]]);
    expect(machine.purgedRoots).toEqual([ROOT]);
    expect(repo.getCurrent()).toBeNull();
  });

  it("leaves a project-scope plugin's files alone", async () => {
    const projectPlugin = InstalledPlugin.fromJSON({
      name: "kept",
      source: { kind: "local", path: "/fixture" },
      version: "1.0.0",
      strict: false,
      files: { "k.md": "h" },
      scope: "project",
      dependents: [],
    });
    const manifest = aManifest()
      .withTool(TOOL.claude, [])
      .withPlugin(TOOL.claude, projectPlugin)
      .build();
    const { files, purge } = fixture({ manifest });

    await purge.purge(ROOT);

    expect(files.removed).toEqual([]);
  });

  it("still purges the machine state and deletes nothing it has no manifest for", async () => {
    const { files, machine, purge } = fixture({ manifest: null });

    await purge.purge(ROOT);

    expect(files.removed).toEqual([]);
    expect(machine.purgedRoots).toEqual([ROOT]);
  });
});

describe("PurgeUserScopeFiles.assertNothingDepends", () => {
  const inspection: UserScopeInspection = {
    manifestFound: true,
    toolIds: [],
    activePluginDependents: [],
    builtVersions: [],
    referencingProjects: [],
  };

  it("passes when nothing depends on what a purge removes", () => {
    expect(() => fixture().purge.assertNothingDepends(inspection)).not.toThrow();
  });

  it("refuses an active plugin dependent", () => {
    expect(() =>
      fixture().purge.assertNothingDepends({ ...inspection, activePluginDependents: ["/a"] })
    ).toThrow(ActiveMachineDependentsError);
  });

  it("refuses a project still referencing the shared framework source", () => {
    expect(() =>
      fixture().purge.assertNothingDepends({ ...inspection, referencingProjects: ["/p"] })
    ).toThrow(ActiveMachineDependentsError);
  });
});

describe("PurgeUserScopeFiles.exclusive", () => {
  it("runs the action and answers its result", async () => {
    await expect(fixture().purge.exclusive(async () => 7)).resolves.toBe(7);
  });
});
