import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../../../src/composition/installation.js";
import { RemoveUserPlugin } from "../../../../../src/contexts/installation/application/removal/remove-user-plugin.use-case.js";
import {
  ActiveMachineDependentsError,
  PluginNotFoundError,
} from "../../../../../src/contexts/installation/domain/installation.error.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { RegistrationRecords } from "../../../../../src/contexts/installation/ports/record/registration-records.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { FakeHostWithdrawal } from "../../testing/fake-host-withdrawal.fake.js";
import { FakeUserScopePluginFiles } from "../../testing/fake-user-scope-plugin-files.fake.js";
import { aManifest } from "../../testing/manifest.builder.js";

const HOME = "/fake-home";
const ROOT = "/project";
const NAME = "aidd-dev";

function userPlugin(dependents: string[] = []) {
  return RecordedPlugin.fromJSON({
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
    dependents?: string[];
    provenFiles?: string[];
    manifest?: ReturnType<ReturnType<typeof aManifest>["build"]>;
    records?: RegistrationRecords;
  } = {}
) {
  const manifest =
    options.manifest ??
    aManifest()
      .withTool(TOOL.claude, [])
      .withPlugin(TOOL.claude, userPlugin(options.dependents))
      .build();
  const repo = new InMemoryManifestRepository(manifest, undefined, options.records);
  const files = new FakeUserScopePluginFiles(
    new Map([[NAME, new Map((options.provenFiles ?? ["a.md", "b.md"]).map((f) => [f, "h"]))]])
  );
  const host = new FakeHostWithdrawal();
  const remove = new RemoveUserPlugin(
    {
      userRepo: repo,
      withdrawFromHost: host,
      userScopePluginFiles: files,
    },
    registeredTools()
  );
  const run = (pluginName = NAME, toolId: AiToolId = TOOL.claude) =>
    remove.execute({
      pluginName,
      toolIds: [toolId],
      projectRoot: ROOT,
      home: HOME,
      records: registrationRecordRules,
    });
  return { repo, files, host, run };
}

describe("removing a user-scope plugin", () => {
  it("deletes the proven files and drops the plugin from the machine manifest", async () => {
    const { repo, files, run } = fixture();

    await run();

    expect(files.removed.map((removed) => [...removed.keys()])).toEqual([["a.md", "b.md"]]);
    expect(repo.getCurrent()?.getPlugins(TOOL.claude)).toEqual([]);
    expect(repo.saveCount).toBe(1);
  });

  it("proves the files under the given home", async () => {
    const { files, run } = fixture();

    await run();

    expect(files.provenHomes).toEqual([HOME]);
  });

  it("names a plugin that is not installed at user scope", async () => {
    const { repo, run } = fixture();

    await expect(run("other")).rejects.toBeInstanceOf(PluginNotFoundError);
    expect(repo.saveCount).toBe(0);
  });

  it("refuses while a project still depends on the plugin, deleting nothing", async () => {
    const { files, repo, run } = fixture({ dependents: ["/other-project"] });

    await expect(run()).rejects.toBeInstanceOf(ActiveMachineDependentsError);
    expect(files.removed).toEqual([]);
    expect(repo.saveCount).toBe(0);
  });

  it("refuses a partial removal when a tracked file escaped its boundary, deleting nothing", async () => {
    const { files, repo, run } = fixture({ provenFiles: ["a.md"] });

    await expect(run()).rejects.toThrow("Refusing partial removal");
    expect(files.removed).toEqual([]);
    expect(repo.getCurrent()?.getPlugins(TOOL.claude)).toHaveLength(1);
  });

  it("leaves a project-scope plugin of the same name in place", async () => {
    const projectScoped = RecordedPlugin.fromMetadata({
      name: NAME,
      version: "1.0.0",
      source: { kind: "local", path: "/fixture" },
      strict: false,
      scope: "project",
    });
    const manifest = aManifest()
      .withTool(TOOL.claude, [])
      .withPlugin(TOOL.claude, projectScoped)
      .build();
    const { files, run } = fixture({ manifest });

    await expect(run()).rejects.toBeInstanceOf(PluginNotFoundError);
    expect(files.removed).toEqual([]);
  });

  describe("native refs", () => {
    function nativeFixture(refs: string[]) {
      const manifest = aManifest().withTool(TOOL.codex, []).build();
      const records: RegistrationRecords = new Map([
        [
          TOOL.codex,
          {
            binary: "codex",
            marketplaces: [],
            pluginRefs: refs,
            pluginClaims: refs.map((ref) => ({ ref, dependents: [] })),
          },
        ],
      ]);
      return fixture({ manifest, records });
    }

    it("uninstalls the claimed ref from the host and drops its claim", async () => {
      const { repo, host, run } = nativeFixture(["p@c"]);

      await run("p@c", TOOL.codex);

      expect(host.uninstalled).toEqual(["p@c"]);
      expect(repo.records.get(TOOL.codex)?.pluginClaims ?? []).toEqual([]);
    });

    it("refuses a bare name that matches several catalogues, uninstalling nothing", async () => {
      const { host, run } = nativeFixture(["p@a", "p@b"]);

      await expect(run("p", TOOL.codex)).rejects.toThrow("multiple catalogues");
      expect(host.uninstalled).toEqual([]);
    });
  });
});
