import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { RecordingPrompter } from "../../shared/testing/recording-prompter.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  AT_PROJECT,
  CleanWithKnownHostSource,
  fileEntry,
  hash,
  PLUGIN_KEY,
  PROJECT_ROOT,
  previewOf,
  RecordingFileAdapter,
  seedTrackedFiles,
} from "../testing/clean-project.builder.js";

describe("clean: confirmation and preview", () => {
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
});
