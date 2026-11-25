import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.use-case.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { resolveHomeTemplate } from "../../../src/contexts/tools/contract/home-path.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../shared/testing/installation-deps.builder.js";
import {
  atProject,
  knownHostSourceCleaner,
  PLUGIN_KEY,
  PROJECT_ROOT,
  RecordingFileAdapter,
} from "../testing/clean-project.builder.js";
import { HOST, hostCatalog, hostUserPluginsDir } from "../testing/synthetic-hosts.builder.js";

const AT_PROJECT = atProject(hostCatalog());
const CleanWithKnownHostSource = knownHostSourceCleaner(hostCatalog(), HOST);

describe("clean: tracked project files", () => {
  it("with force removes .aidd/cache/ entry from .gitignore", async () => {
    const deps = await buildInstallationDeps({ tools: hostCatalog() });
    await initAndInstall(deps, PROJECT_ROOT, HOST.claude);

    const gitignorePath = join(PROJECT_ROOT, ".gitignore");
    await deps.fs.writeFile(gitignorePath, "node_modules/\n.aidd/cache/\ndist/\n");

    const useCase = new CleanWithKnownHostSource(
      deps.fs,
      deps.manifestRepo,
      deps.logger,
      deps.updateGitignore
    );
    await useCase.execute({ ...AT_PROJECT, force: true });

    const content = deps.fs.getFile(gitignorePath);
    expect(content).not.toContain(".aidd/cache/");
    expect(content).toContain("node_modules/");
    expect(content).toContain("dist/");
  });

  it("with force leaves .gitignore unchanged when entry absent", async () => {
    const deps = await buildInstallationDeps({ tools: hostCatalog() });
    await initAndInstall(deps, PROJECT_ROOT, HOST.claude);

    const gitignorePath = join(PROJECT_ROOT, ".gitignore");
    await deps.fs.writeFile(gitignorePath, "node_modules/\n");

    const useCase = new CleanWithKnownHostSource(
      deps.fs,
      deps.manifestRepo,
      deps.logger,
      deps.updateGitignore
    );
    await useCase.execute({ ...AT_PROJECT, force: true });

    const content = deps.fs.getFile(gitignorePath);
    expect(content).toBe("node_modules/\n");
  });

  it("preserves untracked user files", async () => {
    const deps = await buildInstallationDeps({ tools: hostCatalog() });
    await initAndInstall(deps, PROJECT_ROOT, HOST.claude);

    const userFile = join(PROJECT_ROOT, "my-custom-file.txt");
    await deps.fs.writeFile(userFile, "user content");

    const useCase = new CleanWithKnownHostSource(
      deps.fs,
      deps.manifestRepo,
      deps.logger,
      deps.updateGitignore
    );
    await useCase.execute({ ...AT_PROJECT, force: true });

    expect(deps.fs.has(userFile)).toBe(true);
  });

  it("keeps .aidd/config.json and deletes .aidd/cache/ when config.json exists", async () => {
    const deps = await buildInstallationDeps({ tools: hostCatalog() });
    await initAndInstall(deps, PROJECT_ROOT, HOST.claude);

    const configPath = join(PROJECT_ROOT, ".aidd", "config.json");
    const cacheFile = join(PROJECT_ROOT, ".aidd", "cache", "built", "leftover.json");
    await deps.fs.writeFile(configPath, '{"telemetry":{"enabled":true}}');
    await deps.fs.writeFile(cacheFile, "{}");

    const useCase = new CleanWithKnownHostSource(
      deps.fs,
      deps.manifestRepo,
      deps.logger,
      deps.updateGitignore
    );
    await useCase.execute({ ...AT_PROJECT, force: true });

    expect(deps.fs.has(configPath)).toBe(true);
    expect(deps.fs.has(cacheFile)).toBe(false);
    expect(deps.manifestRepo.getCurrent()).toBeNull();
  });

  it("removes .aidd/plugin-cache/, which no install writes but plugin add does", async () => {
    const deps = await buildInstallationDeps({ tools: hostCatalog() });
    await initAndInstall(deps, PROJECT_ROOT, HOST.claude);

    const pluginCacheFile = join(PROJECT_ROOT, ".aidd", "plugin-cache", "some-plugin", "x.json");
    await deps.fs.writeFile(pluginCacheFile, "{}");

    const useCase = new CleanWithKnownHostSource(
      deps.fs,
      deps.manifestRepo,
      deps.logger,
      deps.updateGitignore
    );
    await useCase.execute({ ...AT_PROJECT, force: true });

    expect(deps.fs.has(pluginCacheFile)).toBe(false);
    expect(deps.fs.listUnder(join(PROJECT_ROOT, ".aidd")).length).toBe(0);
  });

  it("removes .aidd/ entirely when nothing but the manifest and cache lived there", async () => {
    const deps = await buildInstallationDeps({ tools: hostCatalog() });
    await initAndInstall(deps, PROJECT_ROOT, HOST.claude);

    const cacheFile = join(PROJECT_ROOT, ".aidd", "cache", "built", "leftover.json");
    await deps.fs.writeFile(cacheFile, "{}");

    const useCase = new CleanWithKnownHostSource(
      deps.fs,
      deps.manifestRepo,
      deps.logger,
      deps.updateGitignore
    );
    await useCase.execute({ ...AT_PROJECT, force: true });

    expect(deps.fs.listUnder(join(PROJECT_ROOT, ".aidd")).length).toBe(0);
  });
  it("removes the marketplaces this project registered, which `marketplace add` wrote", async () => {
    const deps = await buildInstallationDeps({ tools: hostCatalog() });
    await initAndInstall(deps, PROJECT_ROOT, HOST.claude);

    // Written by `marketplace add`, not by an install - so it survived a clean that removed
    // only the caches and the manifest, and its presence kept `.aidd/` alive with it.
    const registry = join(PROJECT_ROOT, ".aidd", "marketplaces.json");
    await deps.fs.writeFile(registry, JSON.stringify({ version: 1, marketplaces: [] }));

    const useCase = new CleanWithKnownHostSource(
      deps.fs,
      deps.manifestRepo,
      deps.logger,
      deps.updateGitignore
    );
    await useCase.execute({ ...AT_PROJECT, force: true });

    expect(deps.fs.has(registry)).toBe(false);
    expect(deps.fs.listUnder(join(PROJECT_ROOT, ".aidd")).length).toBe(0);
  });

  it("removes the registry and still keeps config.json, when a project has both", async () => {
    const deps = await buildInstallationDeps({ tools: hostCatalog() });
    await initAndInstall(deps, PROJECT_ROOT, HOST.claude);

    // The interaction the two rules meet in: one file clean wrote and must take back, one it
    // never wrote and must leave. Each proven alone says nothing about the pair.
    const config = join(PROJECT_ROOT, ".aidd", "config.json");
    const registry = join(PROJECT_ROOT, ".aidd", "marketplaces.json");
    await deps.fs.writeFile(config, JSON.stringify({ telemetry: { enabled: true } }));
    await deps.fs.writeFile(registry, JSON.stringify({ version: 1, marketplaces: [] }));

    const useCase = new CleanWithKnownHostSource(
      deps.fs,
      deps.manifestRepo,
      deps.logger,
      deps.updateGitignore
    );
    await useCase.execute({ ...AT_PROJECT, force: true });

    expect(deps.fs.has(registry)).toBe(false);
    expect(deps.fs.has(config)).toBe(true);
  });

  it("leaves a user-scope Cursor plugin's files to explicit user cleanup", async () => {
    const manifest = Manifest.create();
    manifest.addTool(HOST.cursor, "1.0.0", []);
    manifest.addPlugin(
      HOST.cursor,
      RecordedPlugin.fromJSON({
        name: "aidd-context",
        source: { kind: "local", path: "/some/path" },
        version: "1.0.0",
        strict: false,
        files: { [PLUGIN_KEY]: "abc123abc123abc123abc123abc123ab" },
        scope: "user",
      })
    );

    const fs = new RecordingFileAdapter({}, [PROJECT_ROOT]);
    const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
    const useCase = new CleanWithKnownHostSource(
      fs,
      manifestRepo,
      new CapturingLogger(),
      new UpdateGitignore(fs)
    );
    await useCase.execute({ ...AT_PROJECT, force: true });

    expect(
      fs.deletedPaths.some((p) =>
        p.endsWith(join(resolveHomeTemplate(hostUserPluginsDir, ""), PLUGIN_KEY))
      )
    ).toBe(false);
    expect(fs.deletedPaths).not.toContain(join(PROJECT_ROOT, PLUGIN_KEY));
  });

  it("deletes a cursor plugin's file under projectRoot, not ~/.cursor/plugins/local, when the manifest says scope: project", async () => {
    const manifest = Manifest.create();
    manifest.addTool(HOST.cursor, "1.0.0", []);
    manifest.addPlugin(
      HOST.cursor,
      RecordedPlugin.fromJSON({
        name: "aidd-context",
        source: { kind: "local", path: "/some/path" },
        version: "1.0.0",
        strict: false,
        files: { [PLUGIN_KEY]: "abc123abc123abc123abc123abc123ab" },
        // Disagrees with cursor's own profile, which declares installScope "user".
        scope: "project",
      })
    );

    const fs = new RecordingFileAdapter({}, [PROJECT_ROOT]);
    const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
    const useCase = new CleanWithKnownHostSource(
      fs,
      manifestRepo,
      new CapturingLogger(),
      new UpdateGitignore(fs)
    );
    await useCase.execute({ ...AT_PROJECT, force: true });

    expect(fs.deletedPaths).toContain(join(PROJECT_ROOT, PLUGIN_KEY));
    expect(
      fs.deletedPaths.some((p) => p.includes(resolveHomeTemplate(hostUserPluginsDir, "")))
    ).toBe(false);
  });
});
