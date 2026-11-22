import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.use-case.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { pluginScriptDir } from "../../../src/contexts/tools/domain/hooks/hooks-merge.js";
import { cursor } from "../../../src/contexts/tools/domain/profiles/cursor/cursor.profile.js";
import type { FileHash } from "../../../src/shared/domain/file-hash.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { present } from "../../shared/testing/present.builder.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  AT_PROJECT,
  CleanWithKnownHostSource,
  hash,
  md5,
  PROJECT_ROOT,
  seedTrackedFiles,
} from "../testing/clean-project.builder.js";

describe("clean: removal counts", () => {
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
      const scriptMarker = pluginScriptDir(present(cursor.hooks?.project).scriptsDir, pluginName);
      const command = `./${scriptMarker}run.js`;
      const manifest = Manifest.create();
      manifest.addTool(TOOL.cursor, "1.0.0", []);
      manifest.addPlugin(
        TOOL.cursor,
        RecordedPlugin.fromJSON({
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
