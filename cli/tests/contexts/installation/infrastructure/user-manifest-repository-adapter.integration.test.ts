import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import { UserManifestRepositoryAdapter } from "../../../../src/contexts/installation/infrastructure/user-manifest-repository-adapter.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { manifestFileDeps } from "../testing/manifest-file-deps.builder.js";

describe("storing the user manifest on disk", () => {
  let userConfigDir: string;
  let adapter: UserManifestRepositoryAdapter;

  beforeEach(async () => {
    userConfigDir = await mkdtemp(join(tmpdir(), "aidd-user-manifest-repo-"));
    adapter = new UserManifestRepositoryAdapter(
      () => userConfigDir,
      manifestFileDeps(() => userConfigDir)
    );
  });

  afterEach(async () => {
    await rm(userConfigDir, { recursive: true, force: true });
  });

  describe("a save the atomic writer fails", () => {
    it("keeps the old JSON", async () => {
      const baseline = Manifest.create();
      baseline.addTool(TOOL.cursor, "1.0.0", []);
      await adapter.save(baseline);
      const failing = new UserManifestRepositoryAdapter(
        () => userConfigDir,
        manifestFileDeps(
          () => userConfigDir,
          async () => {
            throw new Error("write failed before rename");
          }
        )
      );
      const replacement = Manifest.create();
      replacement.addTool(TOOL.codex, "1.0.0", []);
      await expect(failing.save(replacement)).rejects.toThrow("write failed before rename");
      expect((await adapter.load())?.getInstalledToolIds()).toEqual(["cursor"]);
    });
  });

  describe("deleting the user manifest", () => {
    it("deletes manifest.json from disk", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);

      await adapter.delete();

      expect(await adapter.load()).toBeNull();
    });

    it("never removes the user config dir itself - auth.json, marketplaces.json and references.json live there too", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);
      // A neighbour this adapter must never touch, standing in for everything else living
      // directly under userConfigDir.
      const neighbour = join(userConfigDir, "marketplaces.json");
      await writeFile(neighbour, "{}");

      await adapter.delete();

      expect(existsSync(userConfigDir)).toBe(true);
      expect(existsSync(neighbour)).toBe(true);
    });

    it("silently succeeds when there is no manifest to delete", async () => {
      await expect(adapter.delete()).resolves.toBeUndefined();
    });
  });

  describe("manifest persistence", () => {
    it("creates the user config dir if it does not exist yet", async () => {
      const freshDir = join(userConfigDir, "not-yet-created");
      const freshAdapter = new UserManifestRepositoryAdapter(
        () => freshDir,
        manifestFileDeps(() => freshDir)
      );

      await freshAdapter.save(Manifest.create());

      expect(existsSync(join(freshDir, "manifest.json"))).toBe(true);
    });
  });
});
