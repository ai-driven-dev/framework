import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import { ManifestRepositoryAdapter } from "../../../../src/contexts/installation/infrastructure/manifest-repository-adapter.js";
import { manifestFileDeps } from "../testing/manifest-file-deps.builder.js";

describe("storing a project manifest on disk", () => {
  let tempDir: string;
  let adapter: ManifestRepositoryAdapter;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-manifest-repo-"));
    adapter = new ManifestRepositoryAdapter(
      tempDir,
      manifestFileDeps(() => join(tempDir, ".aidd"))
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("loading a manifest that may be unreadable", () => {
    it("answers the manifest when it is readable", async () => {
      await adapter.save(Manifest.create());

      expect(await adapter.loadIfReadable()).not.toBeNull();
    });
  });

  describe("deleting a manifest", () => {
    it("prunes empty .aidd/ directory after manifest deletion", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);

      await adapter.delete();

      const { existsSync } = await import("node:fs");
      const aiddDir = join(tempDir, ".aidd");
      expect(existsSync(aiddDir)).toBe(false);
    });

    it("silently succeeds when no manifest to delete", async () => {
      await expect(adapter.delete()).resolves.toBeUndefined();
    });
  });

  describe("manifest persistence", () => {
    it("creates .aidd/ directory if it does not exist", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);

      const { existsSync } = await import("node:fs");
      expect(existsSync(join(tempDir, ".aidd", "manifest.json"))).toBe(true);
    });
  });
});
