import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { pluginScriptDir } from "../../../src/contexts/tools/domain/hooks/hooks-merge.js";
import { CURSOR_HOOKS } from "../../../src/contexts/tools/domain/profiles/cursor/hooks.js";
import type { FileHash } from "../../../src/shared/domain/file-hash.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../shared/testing/installation-deps.builder.js";
import { RecordingPrompter } from "../../shared/testing/recording-prompter.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  AT_PROJECT,
  CleanWithKnownHostSource,
  fileEntry,
  hash,
  md5,
  PLUGIN_KEY,
  PROJECT_ROOT,
  previewOf,
  RecordingFileAdapter,
  seedTrackedFiles,
} from "../testing/clean-project.builder.js";

describe("clean", () => {
  it("with force removes .aidd/cache/ entry from .gitignore", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);

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
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);

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
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);

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
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);

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
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);

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
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);

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
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);

    // Written by `marketplace add`, not by an install — so it survived a clean that removed
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
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);

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
    manifest.addTool(TOOL.cursor, "1.0.0", []);
    manifest.addPlugin(
      TOOL.cursor,
      InstalledPlugin.fromJSON({
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
      fs.deletedPaths.some((p) => p.endsWith(join(".cursor", "plugins", "local", PLUGIN_KEY)))
    ).toBe(false);
    expect(fs.deletedPaths).not.toContain(join(PROJECT_ROOT, PLUGIN_KEY));
  });

  it("deletes a cursor plugin's file under projectRoot, not ~/.cursor/plugins/local, when the manifest says scope: project", async () => {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "1.0.0", []);
    manifest.addPlugin(
      TOOL.cursor,
      InstalledPlugin.fromJSON({
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
    expect(fs.deletedPaths.some((p) => p.includes(join(".cursor", "plugins", "local")))).toBe(
      false
    );
  });

  describe("user-scope files belong to machine cleanup", () => {
    it("leaves both legitimate and escaping user paths untouched", async () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.cursor, "1.0.0", []);
      manifest.addPlugin(
        TOOL.cursor,
        InstalledPlugin.fromJSON({
          name: "aidd-context",
          source: { kind: "local", path: "/some/path" },
          version: "1.0.0",
          strict: false,
          files: {
            [PLUGIN_KEY]: "abc123abc123abc123abc123abc123ab",
            "../../../.ssh/id_rsa": "def456def456def456def456def456de",
          },
          scope: "user",
        })
      );
      const fs = new RecordingFileAdapter({}, [PROJECT_ROOT]);
      const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
      const logger = new CapturingLogger();
      const useCase = new CleanWithKnownHostSource(
        fs,
        manifestRepo,
        logger,
        new UpdateGitignore(fs)
      );

      await useCase.execute({ ...AT_PROJECT, force: true });

      expect(
        fs.deletedPaths.some((p) => p.endsWith(join(".cursor", "plugins", "local", PLUGIN_KEY)))
      ).toBe(false);
      expect(fs.deletedPaths.some((p) => p.includes(join(".ssh", "id_rsa")))).toBe(false);
      expect(logger.warnMessages.some((m) => m.includes("id_rsa"))).toBe(false);
    });

    it("refuses to delete a plugin whose own directory is a symlink resolving outside the user-scope directory", async () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.cursor, "1.0.0", []);
      manifest.addPlugin(
        TOOL.cursor,
        InstalledPlugin.fromJSON({
          name: "aidd-context",
          source: { kind: "local", path: "/some/path" },
          version: "1.0.0",
          strict: false,
          files: { [PLUGIN_KEY]: "abc123abc123abc123abc123abc123ab" },
          scope: "user",
        })
      );
      const fs = new RecordingFileAdapter({}, [PROJECT_ROOT]);
      const boundary = join(homedir(), ".cursor", "plugins", "local");
      fs.setSymlink(join(boundary, "aidd-context"), "/tmp/evil-aidd-context");
      const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
      const logger = new CapturingLogger();
      const useCase = new CleanWithKnownHostSource(
        fs,
        manifestRepo,
        logger,
        new UpdateGitignore(fs)
      );

      await useCase.execute({ ...AT_PROJECT, force: true });

      expect(fs.deletedPaths.some((p) => p.includes("evil"))).toBe(false);
      expect(
        fs.deletedPaths.some((p) => p.endsWith(join(".cursor", "plugins", "local", PLUGIN_KEY)))
      ).toBe(false);
      expect(logger.warnMessages.some((m) => m.includes(PLUGIN_KEY))).toBe(false);
    });
  });

  describe("without a manifest", () => {
    it("reports nothing found and nothing to preview", async () => {
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const useCase = new CleanWithKnownHostSource(
        fs,
        new InMemoryManifestRepository(null, PROJECT_ROOT),
        new CapturingLogger(),
        new UpdateGitignore(fs)
      );

      const result = await useCase.execute({ ...AT_PROJECT, force: true });

      expect(result).toStrictEqual({
        dryRun: false,
        manifestFound: false,
        preview: { tools: [], totalFileCount: 0, nativeRegistrations: [] },
        fileCount: 0,
      });
    });
  });

  describe("confirming before removing anything", () => {
    function buildConfirmingUseCase(
      fs: InMemoryFileAdapter,
      prompter: RecordingPrompter | undefined
    ) {
      return new CleanWithKnownHostSource(
        fs,
        new InMemoryManifestRepository(seedTrackedFiles(fs, ["a.md"]), PROJECT_ROOT),
        new CapturingLogger(),
        new UpdateGitignore(fs),
        new Map(),
        undefined,
        prompter
      );
    }

    it("asks its one question, word for word, and removes everything on yes", async () => {
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const prompter = new RecordingPrompter(true);
      const useCase = buildConfirmingUseCase(fs, prompter);

      const result = await useCase.execute({ ...AT_PROJECT, force: false, interactive: true });

      expect(prompter.confirmMessages).toStrictEqual(["Remove all AIDD files?"]);
      expect(result).toStrictEqual({
        dryRun: false,
        manifestFound: true,
        preview: previewOf([[TOOL.claude, 1]]),
        fileCount: 1,
      });
      expect(fs.has(join(PROJECT_ROOT, "a.md"))).toBe(false);
    });

    it("removes nothing on no and answers with the dry-run preview", async () => {
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const useCase = buildConfirmingUseCase(fs, new RecordingPrompter(false));

      const result = await useCase.execute({ ...AT_PROJECT, force: false, interactive: true });

      expect(result).toStrictEqual({
        dryRun: true,
        manifestFound: true,
        preview: previewOf([[TOOL.claude, 1]]),
        fileCount: 0,
      });
      expect(fs.has(join(PROJECT_ROOT, "a.md"))).toBe(true);
    });

    it("never asks outside an interactive run, even with a prompter wired in", async () => {
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const prompter = new RecordingPrompter(true);
      const useCase = buildConfirmingUseCase(fs, prompter);

      const result = await useCase.execute({ ...AT_PROJECT, force: false });

      expect(prompter.confirmMessages).toStrictEqual([]);
      expect(result).toStrictEqual({
        dryRun: true,
        manifestFound: true,
        preview: previewOf([[TOOL.claude, 1]]),
        fileCount: 0,
      });
    });

    it("stays a dry-run in an interactive run with no prompter wired in", async () => {
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const useCase = buildConfirmingUseCase(fs, undefined);

      const result = await useCase.execute({ ...AT_PROJECT, force: false, interactive: true });

      expect(result.dryRun).toBe(true);
      expect(fs.has(join(PROJECT_ROOT, "a.md"))).toBe(true);
    });
  });

  describe("what a dry-run previews", () => {
    it("counts each tool's tracked and merged files, and totals them", async () => {
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const manifest = seedTrackedFiles(fs, ["a.md", "b.md"]);
      manifest.addTool(TOOL.claude, "1.0.0", [fileEntry("a.md"), fileEntry("b.md")]);
      manifest.updateToolMergeFiles(TOOL.claude, [
        { relativePath: ".claude/settings.json", sectionKey: null, entries: { owned: hash() } },
      ]);
      manifest.addTool(TOOL.codex, "1.0.0", [fileEntry("c.md")]);
      const useCase = new CleanWithKnownHostSource(
        fs,
        new InMemoryManifestRepository(manifest, PROJECT_ROOT),
        new CapturingLogger(),
        new UpdateGitignore(fs)
      );

      const result = await useCase.execute({ ...AT_PROJECT, force: false });

      expect(result).toStrictEqual({
        dryRun: true,
        manifestFound: true,
        preview: previewOf([
          [TOOL.claude, 3],
          [TOOL.codex, 1],
        ]),
        fileCount: 0,
      });
    });

    it("announces no cache path for a host whose profile declares no cache directory (copilot)", async () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.copilot, "1.0.0", []);
      manifest.setNativeRegistrations(TOOL.copilot, {
        binary: "copilot",
        marketplaces: [{ alias: "aidd-framework", hostName: "aidd-framework" }],
        pluginRefs: ["aidd-context@aidd-framework"],
      });
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const useCase = new CleanWithKnownHostSource(
        fs,
        new InMemoryManifestRepository(manifest, PROJECT_ROOT),
        new CapturingLogger(),
        new UpdateGitignore(fs)
      );

      const result = await useCase.execute({ ...AT_PROJECT, force: false });

      expect(result.preview.nativeRegistrations).toStrictEqual([
        {
          toolId: TOOL.copilot,
          binary: "copilot",
          marketplaceCount: 1,
          pluginRefCount: 1,
          cachePaths: [],
        },
      ]);
    });

    it("announces no cache path for a tool that drives no native CLI (cursor)", async () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.cursor, "1.0.0", []);
      manifest.setNativeRegistrations(TOOL.cursor, {
        binary: "cursor",
        marketplaces: [{ alias: "aidd-framework", hostName: "aidd-framework" }],
        pluginRefs: [],
      });
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const useCase = new CleanWithKnownHostSource(
        fs,
        new InMemoryManifestRepository(manifest, PROJECT_ROOT),
        new CapturingLogger(),
        new UpdateGitignore(fs)
      );

      const result = await useCase.execute({ ...AT_PROJECT, force: false });

      expect(result.preview.nativeRegistrations).toStrictEqual([
        {
          toolId: TOOL.cursor,
          binary: "cursor",
          marketplaceCount: 1,
          pluginRefCount: 0,
          cachePaths: [],
        },
      ]);
    });
  });

  describe("counting what was removed", () => {
    function buildCountingUseCase(
      fs: InMemoryFileAdapter,
      manifest: Manifest,
      logger = new CapturingLogger()
    ) {
      return new CleanWithKnownHostSource(
        fs,
        new InMemoryManifestRepository(manifest, PROJECT_ROOT),
        logger,
        new UpdateGitignore(fs)
      );
    }

    it("counts every tracked file and names the tool being removed", async () => {
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const logger = new CapturingLogger();
      const useCase = buildCountingUseCase(fs, seedTrackedFiles(fs, ["a.md", "b.md"]), logger);

      const result = await useCase.execute({ ...AT_PROJECT, force: true });

      expect(result.fileCount).toBe(2);
      expect(fs.has(join(PROJECT_ROOT, "a.md"))).toBe(false);
      expect(fs.has(join(PROJECT_ROOT, "b.md"))).toBe(false);
      expect(logger.infoMessages).toStrictEqual(["Removing claude files..."]);
    });

    it("counts the machine-local settings file a tool wrote outside the manifest", async () => {
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      fs.setFile(join(PROJECT_ROOT, ".claude", "settings.local.json"), "{}");
      const useCase = buildCountingUseCase(fs, seedTrackedFiles(fs, ["a.md"]));

      const result = await useCase.execute({ ...AT_PROJECT, force: true });

      expect(result.fileCount).toBe(2);
    });

    it("does not count a machine-local settings file that was never written", async () => {
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const useCase = buildCountingUseCase(fs, seedTrackedFiles(fs, ["a.md"]));

      const result = await useCase.execute({ ...AT_PROJECT, force: true });

      expect(result.fileCount).toBe(1);
    });

    it("counts the project hooks file a cursor plugin was unmerged from", async () => {
      const pluginName = "aidd-context";
      const scriptMarker = pluginScriptDir(CURSOR_HOOKS.project.scriptsDir, pluginName);
      const command = `./${scriptMarker}run.js`;
      const manifest = Manifest.create();
      manifest.addTool(TOOL.cursor, "1.0.0", []);
      manifest.addPlugin(
        TOOL.cursor,
        InstalledPlugin.fromJSON({
          name: pluginName,
          source: { kind: "local", path: "/p" },
          version: "1.0.0",
          strict: false,
          files: {},
          scope: "project",
          projectHooks: {
            entries: [{ event: "PreToolUse", command, digest: md5(JSON.stringify({ command })) }],
            scripts: {},
          },
        })
      );
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      fs.setFile(
        join(PROJECT_ROOT, ".cursor", "hooks.json"),
        JSON.stringify({
          version: 1,
          hooks: { PreToolUse: [{ command }] },
        })
      );
      const useCase = buildCountingUseCase(fs, manifest);

      const result = await useCase.execute({ ...AT_PROJECT, force: true });

      expect(result.fileCount).toBe(1);
    });

    describe("a file merged into one the project shares", () => {
      const MERGED = ".claude/settings.json";

      function seedMerged(
        fs: InMemoryFileAdapter,
        content: string | null,
        ownedKeys: string[]
      ): Manifest {
        const manifest = Manifest.create();
        const entries: Record<string, FileHash> = {};
        for (const key of ownedKeys) entries[key] = hash();
        manifest.addTool(TOOL.claude, "1.0.0", []);
        manifest.updateToolMergeFiles(TOOL.claude, [
          { relativePath: MERGED, sectionKey: null, entries },
        ]);
        if (content !== null) fs.setFile(join(PROJECT_ROOT, MERGED), content);
        return manifest;
      }

      it("takes back only its own keys, leaving the project's, and counts the file once", async () => {
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const useCase = buildCountingUseCase(
          fs,
          seedMerged(fs, '{"owned":1,"theirs":2}', ["owned"])
        );

        const result = await useCase.execute({ ...AT_PROJECT, force: true });

        expect(fs.getFile(join(PROJECT_ROOT, MERGED))).toBe('{\n  "theirs": 2\n}');
        expect(result.fileCount).toBe(1);
      });

      it("deletes the file once nothing but its own keys was in it", async () => {
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const useCase = buildCountingUseCase(fs, seedMerged(fs, '{"owned":1}', ["owned"]));

        const result = await useCase.execute({ ...AT_PROJECT, force: true });

        expect(fs.has(join(PROJECT_ROOT, MERGED))).toBe(false);
        expect(result.fileCount).toBe(1);
      });

      it("deletes a file it recorded whole, one with no keys of its own", async () => {
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const useCase = buildCountingUseCase(fs, seedMerged(fs, '{"theirs":2}', []));

        const result = await useCase.execute({ ...AT_PROJECT, force: true });

        expect(fs.has(join(PROJECT_ROOT, MERGED))).toBe(false);
        expect(result.fileCount).toBe(1);
      });

      it("skips a merged file already gone, without counting it", async () => {
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const useCase = buildCountingUseCase(fs, seedMerged(fs, null, ["owned"]));

        const result = await useCase.execute({ ...AT_PROJECT, force: true });

        expect(result.fileCount).toBe(0);
      });
    });
  });

  describe("what stays under .aidd/", () => {
    it("says it kept config.json, by its path", async () => {
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      fs.setFile(join(PROJECT_ROOT, ".aidd", "config.json"), "{}");
      const logger = new CapturingLogger();
      const useCase = new CleanWithKnownHostSource(
        fs,
        new InMemoryManifestRepository(seedTrackedFiles(fs, ["a.md"]), PROJECT_ROOT),
        logger,
        new UpdateGitignore(fs)
      );

      await useCase.execute({ ...AT_PROJECT, force: true });

      expect(logger.infoMessages).toStrictEqual([
        "Removing claude files...",
        "Kept .aidd/config.json",
      ]);
    });

    it("says nothing about config.json when another file is what keeps .aidd/ alive", async () => {
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      fs.setFile(join(PROJECT_ROOT, ".aidd", "auth.json"), "{}");
      const logger = new CapturingLogger();
      const useCase = new CleanWithKnownHostSource(
        fs,
        new InMemoryManifestRepository(seedTrackedFiles(fs, ["a.md"]), PROJECT_ROOT),
        logger,
        new UpdateGitignore(fs)
      );

      await useCase.execute({ ...AT_PROJECT, force: true });

      expect(logger.infoMessages).toStrictEqual(["Removing claude files..."]);
    });
  });
});
