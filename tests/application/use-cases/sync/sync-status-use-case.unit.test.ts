import { describe, expect, it } from "vitest";
import { SyncStatusUseCase } from "../../../../src/application/use-cases/sync/sync-status-use-case.js";
import { type FileHash, InstallationFile } from "../../../../src/domain/models/file.js";
import { Manifest } from "../../../../src/domain/models/manifest.js";
import { DeterministicHasher } from "../../../helpers/ports/deterministic-hasher.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";

const PROJECT_ROOT = "/project";

function makeHash(content: string): FileHash {
  return new DeterministicHasher().hash(content);
}

function buildManifestWithTool(
  toolId: "claude" | "cursor",
  files: { relativePath: string; content: string }[]
): Manifest {
  const hasher = new DeterministicHasher();
  const manifest = Manifest.create();
  const installFiles = files.map(
    (f) =>
      new InstallationFile({
        relativePath: f.relativePath,
        content: f.content,
        hash: hasher.hash(f.content),
      })
  );
  manifest.addTool(toolId, "1.0.0", installFiles);
  return manifest;
}

function buildDeps(diskFiles: Record<string, string> = {}) {
  const hasher = new DeterministicHasher();
  const fs = new InMemoryFileAdapter(diskFiles, hasher);
  const useCase = new SyncStatusUseCase(fs);
  return { fs, useCase };
}

describe("SyncStatusUseCase", () => {
  describe("execute", () => {
    it("returns zero modified and deleted when disk files match manifest hashes", async () => {
      const content = "# hello world\n";
      const { useCase } = buildDeps({
        [`${PROJECT_ROOT}/.claude/agents/test.md`]: content,
      });
      const manifest = buildManifestWithTool("claude", [
        { relativePath: ".claude/agents/test.md", content },
      ]);

      const result = await useCase.execute(manifest, ["claude"], PROJECT_ROOT);

      expect(result.claude).toEqual({ modified: 0, deleted: 0 });
    });

    it("increments modified when disk file content differs from manifest hash", async () => {
      const manifestContent = "# original\n";
      const diskContent = "# modified by user\n";
      const { useCase } = buildDeps({
        [`${PROJECT_ROOT}/.claude/agents/test.md`]: diskContent,
      });
      const manifest = buildManifestWithTool("claude", [
        { relativePath: ".claude/agents/test.md", content: manifestContent },
      ]);

      const result = await useCase.execute(manifest, ["claude"], PROJECT_ROOT);

      expect(result.claude).toEqual({ modified: 1, deleted: 0 });
    });

    it("increments deleted when disk file does not exist", async () => {
      const { useCase } = buildDeps({});
      const manifest = buildManifestWithTool("claude", [
        { relativePath: ".claude/agents/test.md", content: "# some content\n" },
      ]);

      const result = await useCase.execute(manifest, ["claude"], PROJECT_ROOT);

      expect(result.claude).toEqual({ modified: 0, deleted: 1 });
    });

    it("counts both modified and deleted across multiple files", async () => {
      const unchanged = "# unchanged\n";
      const { useCase } = buildDeps({
        [`${PROJECT_ROOT}/.claude/agents/unchanged.md`]: unchanged,
        [`${PROJECT_ROOT}/.claude/agents/modified.md`]: "# changed content\n",
        // deleted.md is absent
      });
      const manifest = buildManifestWithTool("claude", [
        { relativePath: ".claude/agents/unchanged.md", content: unchanged },
        { relativePath: ".claude/agents/modified.md", content: "# original content\n" },
        { relativePath: ".claude/agents/deleted.md", content: "# will be deleted\n" },
      ]);

      const result = await useCase.execute(manifest, ["claude"], PROJECT_ROOT);

      expect(result.claude).toEqual({ modified: 1, deleted: 1 });
    });

    it("returns empty result when toolIds list is empty", async () => {
      const { useCase } = buildDeps({});
      const manifest = Manifest.create();

      const result = await useCase.execute(manifest, [], PROJECT_ROOT);

      expect(result).toEqual({});
    });

    it("tracks counts independently per tool", async () => {
      const claudeContent = "# claude\n";
      const cursorContent = "# cursor\n";
      const { useCase } = buildDeps({
        [`${PROJECT_ROOT}/.claude/agents/file.md`]: claudeContent,
        // cursor file is absent → deleted
      });
      const manifest = Manifest.create();
      const hasher = new DeterministicHasher();
      manifest.addTool("claude", "1.0.0", [
        new InstallationFile({
          relativePath: ".claude/agents/file.md",
          content: claudeContent,
          hash: hasher.hash(claudeContent),
        }),
      ]);
      manifest.addTool("cursor", "1.0.0", [
        new InstallationFile({
          relativePath: ".cursor/agents/file.md",
          content: cursorContent,
          hash: hasher.hash(cursorContent),
        }),
      ]);

      const result = await useCase.execute(manifest, ["claude", "cursor"], PROJECT_ROOT);

      expect(result.claude).toEqual({ modified: 0, deleted: 0 });
      expect(result.cursor).toEqual({ modified: 0, deleted: 1 });
    });

    it("returns zero counts for a tool with no tracked files", async () => {
      const { useCase } = buildDeps({});
      const manifest = Manifest.create();
      manifest.addTool("claude", "1.0.0", []);

      const result = await useCase.execute(manifest, ["claude"], PROJECT_ROOT);

      expect(result.claude).toEqual({ modified: 0, deleted: 0 });
    });

    it("resolves disk path by joining projectRoot with relativePath", async () => {
      const content = "# file at nested path\n";
      const { useCase } = buildDeps({
        [`${PROJECT_ROOT}/.claude/commands/aidd/04/implement.md`]: content,
      });
      const manifest = buildManifestWithTool("claude", [
        { relativePath: ".claude/commands/aidd/04/implement.md", content },
      ]);

      const result = await useCase.execute(manifest, ["claude"], PROJECT_ROOT);

      expect(result.claude).toEqual({ modified: 0, deleted: 0 });
    });

    it("uses manifest hash value — only the exact same content hash is considered unchanged", async () => {
      const content = "# consistent\n";
      const hash = makeHash(content);
      const { useCase } = buildDeps({
        [`${PROJECT_ROOT}/.claude/agents/x.md`]: content,
      });
      const manifest = Manifest.create();
      manifest.addTool("claude", "1.0.0", [
        new InstallationFile({
          relativePath: ".claude/agents/x.md",
          content,
          hash,
        }),
      ]);

      const result = await useCase.execute(manifest, ["claude"], PROJECT_ROOT);

      expect(result.claude).toEqual({ modified: 0, deleted: 0 });
    });
  });
});
