import "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginRemoveUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-remove-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import {
  InstalledPlugin,
  type PluginEntryData,
} from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { PluginNotFoundError } from "../../../../../src/kernel/errors.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { FakeHostPluginRegistryReader } from "../../../../helpers/ports/fake-host-plugin-registry-reader.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";

const ROOT = "/test-project";
const OTHER = "/another-project";
const NAME = "wanted-plugin";

function plugin(overrides: Partial<PluginEntryData> = {}): InstalledPlugin {
  return InstalledPlugin.fromJSON({
    name: NAME,
    source: { kind: "local", path: "/plugin-source" },
    version: "1.0.0",
    strict: false,
    files: {},
    scope: "user",
    ...overrides,
  });
}

function manifest(): Manifest {
  const result = Manifest.create();
  result.addTool("cursor", "1.0.0", []);
  result.addTool("claude", "1.0.0", []);
  return result;
}

describe("plugin removal selects the recorded owner, name and tool", () => {
  it("detaches only the selected user plugin's project claim while preserving machine files", async () => {
    const project = manifest();
    const machine = manifest();
    for (const toolId of ["cursor", "claude"] as const) {
      for (const name of ["other-plugin", NAME]) {
        project.addPlugin(toolId, plugin({ name, files: { [`${name}/keep.md`]: "digest" } }));
        machine.addPlugin(toolId, plugin({ name, dependents: [ROOT, OTHER] }));
      }
    }
    const fs = new InMemoryFileAdapter();
    const witness = join(homedir(), ".cursor", "plugins", "local", NAME, "keep.md");
    fs.setFile(witness, "machine bytes");
    const projectRepo = new InMemoryManifestRepository(project, ROOT);
    const userRepo = new InMemoryManifestRepository(machine);
    const remove = new PluginRemoveUseCase(
      fs,
      projectRepo,
      new CapturingLogger(),
      new Map(),
      new Map(),
      undefined,
      undefined,
      userRepo
    );

    await remove.execute({ pluginName: NAME, toolIds: ["cursor"], projectRoot: ROOT });

    expect(project.getPlugins("cursor").map((entry) => entry.name)).toEqual(["other-plugin"]);
    expect(project.getPlugins("claude").map((entry) => entry.name)).toEqual(["other-plugin", NAME]);
    expect(machine.getPlugins("cursor").map((entry) => [entry.name, entry.dependents])).toEqual([
      ["other-plugin", [ROOT, OTHER]],
      [NAME, [OTHER]],
    ]);
    expect(machine.getPlugins("claude").map((entry) => entry.dependents)).toEqual([
      [ROOT, OTHER],
      [ROOT, OTHER],
    ]);
    expect(fs.getFile(witness)).toBe("machine bytes");
    expect(projectRepo.saveCount).toBe(1);
    expect(userRepo.saveCount).toBe(1);
  });

  it("removing a project entry does not detach the same name's machine claim", async () => {
    const project = manifest();
    const machine = manifest();
    project.addPlugin("cursor", plugin({ scope: "project", files: { "owned.md": "digest" } }));
    project.addPlugin("cursor", plugin({ name: "other-plugin", scope: "user" }));
    machine.addPlugin("cursor", plugin({ dependents: [ROOT, OTHER] }));
    machine.addPlugin("cursor", plugin({ name: "other-plugin", dependents: [ROOT, OTHER] }));
    const before = machine.toJSON();
    const fs = new InMemoryFileAdapter({
      [join(ROOT, "owned.md")]: "owned",
      [join(ROOT, "foreign.md")]: "foreign",
    });
    const userRepo = new InMemoryManifestRepository(machine);
    const remove = new PluginRemoveUseCase(
      fs,
      new InMemoryManifestRepository(project, ROOT),
      new CapturingLogger(),
      new Map(),
      new Map(),
      undefined,
      undefined,
      userRepo
    );

    await remove.execute({ pluginName: NAME, toolIds: ["cursor"], projectRoot: ROOT });

    expect(await fs.fileExists(join(ROOT, "owned.md"))).toBe(false);
    expect(fs.getFile(join(ROOT, "foreign.md"))).toBe("foreign");
    expect(machine.toJSON()).toEqual(before);
    expect(userRepo.saveCount).toBe(0);
    expect(project.getPlugins("cursor").map((entry) => entry.name)).toEqual(["other-plugin"]);
  });

  it("user removal skips a project-scoped copy and other names with active dependents", async () => {
    const project = manifest();
    project.addPlugin("cursor", plugin({ scope: "project" }));
    const machine = manifest();
    machine.addPlugin("cursor", plugin({ name: "other-plugin", dependents: [OTHER] }));
    machine.addPlugin("cursor", plugin());
    machine.addPlugin("claude", plugin({ scope: "project", dependents: [OTHER] }));
    const projectBefore = project.toJSON();
    const otherBefore = machine.getPlugins("cursor")[0].toJSON();
    const claudeBefore = machine.getPlugins("claude")[0].toJSON();
    const userRepo = new InMemoryManifestRepository(machine);
    const projectRepo = new InMemoryManifestRepository(project, ROOT);
    const remove = new PluginRemoveUseCase(
      new InMemoryFileAdapter(),
      projectRepo,
      new CapturingLogger(),
      new Map(),
      new Map(),
      undefined,
      undefined,
      userRepo
    );

    await remove.execute({ pluginName: NAME, toolIds: "all", projectRoot: ROOT, scope: "user" });

    expect(machine.getPlugins("cursor").map((entry) => entry.toJSON())).toEqual([otherBefore]);
    expect(machine.getPlugins("claude").map((entry) => entry.toJSON())).toEqual([claudeBefore]);
    expect(project.toJSON()).toEqual(projectBefore);
    expect(projectRepo.saveCount).toBe(0);
    expect(userRepo.saveCount).toBe(1);
  });

  it("user removal reports a project-only match as absent without saving either manifest", async () => {
    const machine = manifest();
    machine.addPlugin("cursor", plugin({ scope: "project" }));
    const before = machine.toJSON();
    const userRepo = new InMemoryManifestRepository(machine);
    const projectRepo = new InMemoryManifestRepository(manifest(), ROOT);
    const remove = new PluginRemoveUseCase(
      new InMemoryFileAdapter(),
      projectRepo,
      new CapturingLogger(),
      new Map(),
      new Map(),
      undefined,
      undefined,
      userRepo
    );

    await expect(
      remove.execute({ pluginName: NAME, toolIds: ["cursor"], projectRoot: ROOT, scope: "user" })
    ).rejects.toThrow(PluginNotFoundError);

    expect(machine.toJSON()).toEqual(before);
    expect(userRepo.saveCount).toBe(0);
    expect(projectRepo.saveCount).toBe(0);
  });

  it("requires a user repository before attempting user removal", async () => {
    const projectRepo = new InMemoryManifestRepository(manifest(), ROOT);
    const remove = new PluginRemoveUseCase(
      new InMemoryFileAdapter(),
      projectRepo,
      new CapturingLogger(),
      new Map()
    );

    await expect(
      remove.execute({ pluginName: NAME, toolIds: ["cursor"], projectRoot: ROOT, scope: "user" })
    ).rejects.toThrow("User manifest repository is required for user-scope plugin removal.");
    expect(projectRepo.saveCount).toBe(0);
  });

  it("explicit user removal deletes the proven machine file without touching the project copy", async () => {
    const relative = `${NAME}/commands/owned.md`;
    const content = "installed machine bytes";
    const machine = manifest();
    machine.addPlugin(
      "cursor",
      plugin({ files: { [relative]: createHash("md5").update(content).digest("hex") } })
    );
    const fs = new InMemoryFileAdapter();
    const userPath = join(homedir(), ".cursor", "plugins", "local", relative);
    const projectPath = join(ROOT, relative);
    fs.setFile(userPath, content);
    fs.setFile(projectPath, "project bytes");
    const userRepo = new InMemoryManifestRepository(machine);
    const remove = new PluginRemoveUseCase(
      fs,
      new InMemoryManifestRepository(manifest(), ROOT),
      new CapturingLogger(),
      new Map(),
      new Map(),
      undefined,
      undefined,
      userRepo
    );

    await remove.execute({
      pluginName: NAME,
      toolIds: ["cursor"],
      projectRoot: ROOT,
      scope: "user",
    });

    expect(await fs.fileExists(userPath)).toBe(false);
    expect(fs.getFile(projectPath)).toBe("project bytes");
    expect(machine.getPlugins("cursor")).toEqual([]);
    expect(userRepo.saveCount).toBe(1);
  });

  it("refuses a partial user removal before deleting safe files when another tracked path escapes", async () => {
    const content = "installed bytes";
    const hash = createHash("md5").update(content).digest("hex");
    const relative = `${NAME}/owned.md`;
    const machine = manifest();
    machine.addPlugin("cursor", plugin({ files: { [relative]: hash, "../outside.md": hash } }));
    const before = machine.toJSON();
    const base = join(homedir(), ".cursor", "plugins", "local");
    const fs = new InMemoryFileAdapter({
      [join(base, relative)]: content,
      [join(base, "../outside.md")]: content,
    });
    const userRepo = new InMemoryManifestRepository(machine);
    const remove = new PluginRemoveUseCase(
      fs,
      new InMemoryManifestRepository(manifest(), ROOT),
      new CapturingLogger(),
      new Map(),
      new Map(),
      undefined,
      undefined,
      userRepo
    );

    await expect(
      remove.execute({ pluginName: NAME, toolIds: ["cursor"], projectRoot: ROOT, scope: "user" })
    ).rejects.toThrow(
      `Refusing partial removal of user-scope plugin '${NAME}': a tracked file escaped its boundary.`
    );

    expect(fs.getFile(join(base, relative))).toBe(content);
    expect(fs.getFile(join(base, "../outside.md"))).toBe(content);
    expect(machine.toJSON()).toEqual(before);
    expect(userRepo.saveCount).toBe(0);
  });

  it("refuses unproven project hooks before deleting any tracked plugin file", async () => {
    const project = manifest();
    project.addPlugin("cursor", plugin({ scope: "project", files: { "owned.md": "digest" } }));
    const before = project.toJSON();
    const script = join(ROOT, ".cursor", "hooks", NAME, "edited.sh");
    const file = join(ROOT, "owned.md");
    const fs = new InMemoryFileAdapter({
      [script]: "unproven hook bytes",
      [file]: "installed plugin bytes",
    });
    const repo = new InMemoryManifestRepository(project, ROOT);
    const remove = new PluginRemoveUseCase(fs, repo, new CapturingLogger(), new Map());

    await expect(
      remove.execute({ pluginName: NAME, toolIds: ["cursor"], projectRoot: ROOT })
    ).rejects.toThrow(/unproven legacy install digest/);

    expect(fs.getFile(file)).toBe("installed plugin bytes");
    expect(fs.getFile(script)).toBe("unproven hook bytes");
    expect(project.toJSON()).toEqual(before);
    expect(repo.saveCount).toBe(0);
  });

  it("preserves a scope-aware host ref when no activator confirmed its removal", async () => {
    const project = manifest();
    project.addPlugin("claude", plugin({ scope: "project", marketplace: "local-alias" }));
    const ref = `${NAME}@host-catalogue`;
    const registrations = {
      binary: "claude",
      marketplaces: [{ alias: "local-alias", hostName: "host-catalogue" }],
      pluginRefs: [ref, "other-plugin@host-catalogue"],
      pluginClaims: [{ ref, dependents: [ROOT, OTHER] }],
    };
    project.setNativeRegistrations("claude", registrations);
    const machine = manifest();
    machine.setNativeRegistrations("claude", registrations);
    const repo = new InMemoryManifestRepository(project, ROOT);
    const userRepo = new InMemoryManifestRepository(machine);
    const remove = new PluginRemoveUseCase(
      new InMemoryFileAdapter(),
      repo,
      new CapturingLogger(),
      new Map(),
      new Map(),
      undefined,
      undefined,
      userRepo
    );

    await remove.execute({ pluginName: NAME, toolIds: ["claude"], projectRoot: ROOT });

    expect(project.getNativeRegistrations("claude")?.pluginRefs).toEqual([
      ref,
      "other-plugin@host-catalogue",
    ]);
    expect(machine.getNativeRegistrations("claude")?.pluginRefs).toEqual([
      ref,
      "other-plugin@host-catalogue",
    ]);
    expect(machine.getNativeRegistrations("claude")?.pluginClaims).toEqual([
      { ref, dependents: [OTHER] },
    ]);
    expect(project.getPlugins("claude")).toEqual([]);
    expect(userRepo.saveCount).toBe(1);
    expect(repo.saveCount).toBe(1);
  });
});

describe("native removal preserves unconfirmed refs and addresses the recorded catalogue", () => {
  const ALIAS = "local-alias";
  const HOST = "host-catalogue";
  const REF = `${NAME}@${HOST}`;
  const FOREIGN = `other-plugin@${HOST}`;
  const provenance = { kind: "registry" as const, source: "/plugin-source" };

  function fixture(
    options: {
      available?: boolean;
      fail?: boolean;
      enabled?: boolean;
      registrations?: boolean;
    } = {}
  ) {
    const record = manifest();
    record.addPlugin(
      "claude",
      plugin({ scope: "project", marketplace: ALIAS, files: { "owned.md": "digest" } })
    );
    record.addPlugin(
      "claude",
      plugin({ name: "other-plugin", scope: "project", marketplace: "other-alias" })
    );
    if (options.registrations !== false)
      record.setNativeRegistrations("claude", {
        binary: "claude",
        marketplaces: [
          { alias: "other-alias", hostName: "other-host", provenance },
          { alias: ALIAS, hostName: HOST, provenance },
        ],
        pluginRefs: options.enabled === false ? [FOREIGN] : [FOREIGN, REF],
      });
    const fs = new InMemoryFileAdapter({ [join(ROOT, "owned.md")]: "owned" });
    const cache = join(
      homedir(),
      ".claude",
      "plugins",
      "cache",
      HOST,
      NAME,
      "1.0.0",
      "plugin.json"
    );
    const foreignCache = join(
      homedir(),
      ".claude",
      "plugins",
      "cache",
      HOST,
      "other-plugin",
      "1.0.0",
      "plugin.json"
    );
    fs.setFile(cache, "target cache");
    fs.setFile(foreignCache, "foreign cache");
    const activator = new FakeNativePluginActivator({
      available: options.available ?? true,
      failOnUninstall: options.fail ? [REF] : [],
    });
    const logger = new CapturingLogger();
    const repo = new InMemoryManifestRepository(record, ROOT);
    const remove = new PluginRemoveUseCase(
      fs,
      repo,
      logger,
      new Map([["claude", activator]]),
      new Map([
        [
          "claude",
          new FakeHostPluginRegistryReader({
            location: "/host/registry",
            refs: new Map([[REF, { enabled: true, scope: "project" }]]),
          }),
        ],
      ]),
      undefined,
      undefined,
      undefined,
      new Map([
        [
          "claude",
          {
            read: async () => ({
              location: "/host/catalogues",
              entries: new Map([[HOST, provenance]]),
            }),
          },
        ],
      ])
    );
    return { record, fs, cache, foreignCache, activator, logger, repo, remove };
  }

  it("removes the exact confirmed ref and cache while preserving sibling registrations", async () => {
    const f = fixture();
    const marketplaces = f.record.getNativeRegistrations("claude")?.marketplaces;

    await f.remove.execute({ pluginName: NAME, toolIds: ["claude"], projectRoot: ROOT });

    expect(f.activator.uninstalledPlugins).toEqual([REF]);
    expect(f.activator.uninstalledPluginScopes).toEqual(["project"]);
    expect(f.record.getNativeRegistrations("claude")?.pluginRefs).toEqual([FOREIGN]);
    expect(f.record.getNativeRegistrations("claude")?.marketplaces).toEqual(marketplaces);
    expect(f.record.getPlugins("claude").map((entry) => entry.name)).toEqual(["other-plugin"]);
    expect(await f.fs.fileExists(f.cache)).toBe(false);
    expect(f.fs.getFile(f.foreignCache)).toBe("foreign cache");
    expect(await f.fs.fileExists(join(ROOT, "owned.md"))).toBe(false);
    expect(f.logger.infoMessages).toEqual([
      `claude: cache for '${NAME}' purged: ${join(homedir(), ".claude", "plugins", "cache", HOST, NAME)}`,
    ]);
    expect(f.logger.warnMessages).toEqual([]);
    expect(f.repo.saveCount).toBe(1);
  });

  it.each([{ available: false }, { fail: true }])(
    "retains host refs and cache when native removal is unconfirmed: %j",
    async (options) => {
      const f = fixture(options);

      await f.remove.execute({ pluginName: NAME, toolIds: ["claude"], projectRoot: ROOT });

      expect(f.record.getNativeRegistrations("claude")?.pluginRefs).toEqual([FOREIGN, REF]);
      expect(f.fs.getFile(f.cache)).toBe("target cache");
      expect(f.fs.getFile(f.foreignCache)).toBe("foreign cache");
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.logger.warnMessages).toContain(
        `claude: cache for '${NAME}' left in place, its own removal was not confirmed: ${join(homedir(), ".claude", "plugins", "cache", HOST, NAME)}`
      );
      expect(f.logger.infoMessages).toEqual([]);
      expect(f.record.getPlugins("claude").map((entry) => entry.name)).toEqual(["other-plugin"]);
    }
  );

  it("leaves an unclaimed enabled plugin on the host while removing only local files", async () => {
    const f = fixture({ enabled: false });

    await f.remove.execute({ pluginName: NAME, toolIds: ["claude"], projectRoot: ROOT });

    expect(f.activator.uninstalledPlugins).toEqual([]);
    expect(f.record.getNativeRegistrations("claude")?.pluginRefs).toEqual([FOREIGN]);
    expect(f.fs.getFile(f.cache)).toBe("target cache");
    expect(f.logger.warnMessages).toEqual([
      `claude: '${REF}' is not a ref this project enabled — left enabled.`,
    ]);
    expect(f.logger.infoMessages).toEqual([]);
    expect(await f.fs.fileExists(join(ROOT, "owned.md"))).toBe(false);
  });

  it("names the local alias when an unavailable host has no recorded catalogue", async () => {
    const f = fixture({ available: false, registrations: false });

    await f.remove.execute({ pluginName: NAME, toolIds: ["claude"], projectRoot: ROOT });

    expect(f.activator.uninstalledPlugins).toEqual([]);
    expect(f.record.getNativeRegistrations("claude")).toBeUndefined();
    expect(f.fs.getFile(f.cache)).toBe("target cache");
    expect(f.logger.warnMessages).toEqual([
      `claude CLI not found on PATH — '${NAME}@${ALIAS}' was not uninstalled from the host; its ref may remain enabled after local removal.`,
    ]);
    expect(f.repo.saveCount).toBe(1);
  });

  it("detaches only this project's exact machine-owned native claim without disabling the shared ref", async () => {
    const project = Manifest.create();
    project.addTool("codex", "1.0.0", []);
    project.addTool("cursor", "1.0.0", []);
    project.addPlugin("codex", plugin({ scope: "project", marketplace: ALIAS }));
    const provenance = {
      kind: "effective-list" as const,
      root: "/host/root",
      sourceType: "local",
      source: "/plugin-source",
    };
    const registrations = {
      binary: "codex",
      marketplaces: [{ alias: ALIAS, hostName: HOST, provenance }],
      pluginRefs: [FOREIGN, REF],
      pluginClaims: [
        { ref: FOREIGN, dependents: [ROOT, OTHER] },
        { ref: REF, dependents: [ROOT, OTHER] },
      ],
    };
    project.setNativeRegistrations("codex", registrations);
    const machine = Manifest.create();
    machine.addTool("codex", "1.0.0", []);
    machine.setNativeRegistrations("codex", registrations);
    const userRepo = new InMemoryManifestRepository(machine);
    const projectRepo = new InMemoryManifestRepository(project, ROOT);
    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();
    const remove = new PluginRemoveUseCase(
      new InMemoryFileAdapter(),
      projectRepo,
      logger,
      new Map([["codex", activator]]),
      new Map(),
      undefined,
      undefined,
      userRepo,
      new Map([
        [
          "codex",
          {
            read: async () => ({
              location: "/host/catalogues",
              entries: new Map([[HOST, provenance]]),
            }),
          },
        ],
      ])
    );

    await remove.execute({ pluginName: NAME, toolIds: "all", projectRoot: ROOT });

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(machine.getNativeRegistrations("codex")?.pluginRefs).toEqual([FOREIGN, REF]);
    expect(machine.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: FOREIGN, dependents: [ROOT, OTHER] },
      { ref: REF, dependents: [OTHER] },
    ]);
    expect(project.getNativeRegistrations("codex")?.pluginRefs).toEqual([FOREIGN]);
    expect(project.getPlugins("codex")).toEqual([]);
    expect(project.getPlugins("cursor")).toEqual([]);
    expect(userRepo.saveCount).toBe(1);
    expect(projectRepo.saveCount).toBe(1);
    expect(logger.warnMessages).toEqual([
      `codex: '${REF}' is an AIDD-owned machine plugin ref — left enabled; this project's claim detaches after local removal.`,
    ]);
  });
});
