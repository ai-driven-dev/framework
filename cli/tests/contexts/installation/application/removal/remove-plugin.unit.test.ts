import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../../../src/composition/installation.js";
import { RemovePlugin } from "../../../../../src/contexts/installation/application/removal/remove-plugin.js";
import { PluginNotFoundError } from "../../../../../src/contexts/installation/domain/installation.error.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { FakeProjectPluginWithdrawal } from "../../testing/fake-project-plugin-withdrawal.fake.js";
import { aManifest } from "../../testing/manifest.builder.js";

const ROOT = "/project";
const NAME = "aidd-dev";
const REF = "aidd-dev@framework";

function plugin(scope: Scope = "project") {
  return InstalledPlugin.fromJSON({
    name: NAME,
    source: { kind: "local", path: "/fixture" },
    version: "1.0.0",
    strict: false,
    files: { "skills/a.md": "h1" },
    scope,
    marketplace: "framework",
  });
}

function fixture(
  options: {
    scope?: Scope;
    toolId?: AiToolId;
    answers?: ConstructorParameters<typeof FakeProjectPluginWithdrawal>[0];
  } = {}
) {
  const toolId = options.toolId ?? TOOL.claude;
  const manifest = aManifest()
    .withTool(toolId, [])
    .withPlugin(toolId, plugin(options.scope))
    .build();
  manifest.setNativeRegistrations(toolId, {
    binary: "claude",
    marketplaces: [{ alias: "framework", hostName: "framework" }],
    pluginRefs: [REF],
  });
  const repo = new InMemoryManifestRepository(manifest, ROOT);
  const fs = new InMemoryFileAdapter({
    [join(ROOT, "skills/a.md")]: "a",
    [join(ROOT, "keep.md")]: "k",
  });
  const withdrawal = new FakeProjectPluginWithdrawal(options.answers);
  const remove = new RemovePlugin(
    { fs, projectRepo: repo, withdrawal, records: registrationRecordRules },
    registeredTools()
  );
  const run = (pluginName = NAME) =>
    remove.execute({ pluginName, toolIds: [toolId], projectRoot: ROOT });
  return { repo, fs, withdrawal, run };
}

describe("RemovePlugin", () => {
  it("deletes the tracked files, drops the plugin from the manifest and saves it", async () => {
    const { repo, fs, run } = fixture();

    await run();

    expect(fs.has(join(ROOT, "skills/a.md"))).toBe(false);
    expect(fs.has(join(ROOT, "keep.md"))).toBe(true);
    expect(repo.getCurrent()?.getPlugins(TOOL.claude)).toEqual([]);
    expect(repo.saveCount).toBe(1);
  });

  it("names a plugin no selected tool has, saving nothing", async () => {
    const { repo, run } = fixture();

    await expect(run("other")).rejects.toBeInstanceOf(PluginNotFoundError);
    expect(repo.saveCount).toBe(0);
  });

  it("deletes nothing when the host refuses to let the plugin go", async () => {
    const refusal = new Error("host keeps it");
    const { repo, fs, run } = fixture({ answers: { refuseSource: refusal } });

    await expect(run()).rejects.toBe(refusal);
    expect(fs.has(join(ROOT, "skills/a.md"))).toBe(true);
    expect(repo.saveCount).toBe(0);
  });

  it("asks the host to withdraw the plugin before it deletes any file", async () => {
    const { withdrawal, run } = fixture();

    await run();

    expect(withdrawal.calls).toEqual([`assertSource:${TOOL.claude}`, `withdraw:${NAME}`]);
  });

  it("lets go of the native ref the manifest recorded for the plugin", async () => {
    const { withdrawal, run } = fixture();

    await run();

    expect(withdrawal.detachedRefs).toEqual([new Map([[TOOL.claude, [REF]]])]);
  });

  it("drops the ref from the registration record when the host lets it go", async () => {
    const { repo, run } = fixture();

    await run();

    expect(repo.getCurrent()?.getNativeRegistrations(TOOL.claude)?.pluginRefs).toEqual([]);
  });

  it("keeps the ref in the registration record when the host does not let it go", async () => {
    const { repo, run } = fixture({ answers: { canDetachRef: false } });

    await run();

    expect(repo.getCurrent()?.getNativeRegistrations(TOOL.claude)?.pluginRefs).toEqual([REF]);
  });

  it("detaches a user-scope plugin from the machine without deleting its files", async () => {
    const { fs, withdrawal, run } = fixture({ scope: "user", toolId: TOOL.cursor });
    const userBase = registeredTools()
      .aiProfile(TOOL.cursor)
      .plugins()
      ?.userPluginsBaseDir(homedir());
    const userFile = join(userBase ?? "", "skills/a.md");
    fs.setFile(userFile, "a");

    await run();

    expect(fs.has(userFile)).toBe(true);
    expect(withdrawal.detachedUserPlugins).toEqual([[TOOL.cursor, NAME]]);
  });

  it("detaches no user plugin for a project-scope one", async () => {
    const { withdrawal, run } = fixture();

    await run();

    expect(withdrawal.detachedUserPlugins).toEqual([]);
  });
});
