import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Manifest } from "../../../../src/contexts/framework/domain/manifest.js";
import { UserManifestRepositoryAdapter } from "../../../../src/contexts/framework/infrastructure/user-manifest-repository-adapter.js";
import { atomicWriteFile } from "../../../../src/runtime/filesystem/atomic-write.js";

describe("UserManifestRepositoryAdapter", () => {
  let userConfigDir: string;
  let adapter: UserManifestRepositoryAdapter;

  beforeEach(async () => {
    userConfigDir = await mkdtemp(join(tmpdir(), "aidd-user-manifest-repo-"));
    adapter = new UserManifestRepositoryAdapter(() => userConfigDir, atomicWriteFile);
  });

  afterEach(async () => {
    await rm(userConfigDir, { recursive: true, force: true });
  });

  it("names manifest.json directly under the user config dir, no .aidd nesting", () => {
    expect(adapter.path).toBe(join(userConfigDir, "manifest.json"));
  });

  describe("load()", () => {
    it("returns null when manifest.json does not exist", async () => {
      expect(await adapter.load()).toBeNull();
    });

    it("rejects with an instructive error naming the file when manifest.json is truncated", async () => {
      const manifestPath = join(userConfigDir, "manifest.json");
      await writeFile(manifestPath, '{"version": 8, "tools": {');

      await expect(adapter.load()).rejects.toThrow(manifestPath);
    });

    it('rejects a refused manifest version naming the real user manifest path and `aidd setup --scope user`, never .aidd/manifest.json or "in this project"', async () => {
      const manifestPath = join(userConfigDir, "manifest.json");
      await writeFile(manifestPath, '{"version": 7, "tools": {}}');

      await expect(adapter.load()).rejects.toThrow(
        new RegExp(
          `${manifestPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*aidd setup --scope user`
        )
      );
      await expect(adapter.load()).rejects.not.toThrow(/\.aidd\/manifest\.json/);
      await expect(adapter.load()).rejects.not.toThrow(/in this project/);
    });

    it("names this machine as where the refused manifest lives", async () => {
      const manifestPath = join(userConfigDir, "manifest.json");
      await writeFile(manifestPath, '{"version": 7, "tools": {}}');

      await expect(adapter.load()).rejects.toThrow(
        `delete ${manifestPath} for this machine, then run \`aidd setup --scope user\` to reinstall the framework.`
      );
    });
  });

  describe("save() + load() roundtrip", () => {
    it("persists and restores the manifest without data loss", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);

      const loaded = await adapter.load();
      expect(loaded?.getInstalledToolIds()).toHaveLength(0);
    });

    it("manifest version is 8 after roundtrip — same schema, same version as the project manifest", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);

      const loaded = await adapter.load();
      expect(loaded?.toJSON().version).toBe(8);
    });
  });

  describe("exclusive machine mutations", () => {
    it("fails closed at the bounded deadline without stealing another process's lock", async () => {
      const lock = `${adapter.path}.lock`;
      await mkdir(lock);
      const now = vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(30_000);
      await expect(adapter.withExclusiveAccess(async () => {})).rejects.toThrow(
        /User manifest is busy.*\.lock/
      );
      now.mockRestore();
      expect(existsSync(lock)).toBe(true);
    });

    it("serializes two claims so the second reads the first after the lock releases", async () => {
      const second = new UserManifestRepositoryAdapter(() => userConfigDir, atomicWriteFile);
      let release = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const firstMutation = adapter.withExclusiveAccess(async () => {
        const manifest = (await adapter.load()) ?? Manifest.create();
        manifest.addTool("cursor", "1.0.0", []);
        await adapter.save(manifest);
        await held;
      });
      await pause(20);
      expect(existsSync(`${adapter.path}.lock`)).toBe(true);
      let secondEntered = false;
      const secondMutation = second.withExclusiveAccess(async () => {
        secondEntered = true;
        const manifest = (await second.load()) ?? Manifest.create();
        manifest.addTool("codex", "1.0.0", []);
        await second.save(manifest);
      });
      await pause(150);
      expect(secondEntered).toBe(false);
      release();
      await Promise.all([firstMutation, secondMutation]);
      expect((await adapter.load())?.getInstalledToolIds()).toEqual(["cursor", "codex"]);
      expect(existsSync(`${adapter.path}.lock`)).toBe(false);
    });

    it("keeps the old JSON and releases the lock when the atomic writer fails", async () => {
      const baseline = Manifest.create();
      baseline.addTool("cursor", "1.0.0", []);
      await adapter.save(baseline);
      const failing = new UserManifestRepositoryAdapter(
        () => userConfigDir,
        async () => {
          throw new Error("write failed before rename");
        }
      );
      const replacement = Manifest.create();
      replacement.addTool("codex", "1.0.0", []);
      await expect(failing.withExclusiveAccess(() => failing.save(replacement))).rejects.toThrow(
        "write failed before rename"
      );
      expect((await adapter.load())?.getInstalledToolIds()).toEqual(["cursor"]);
      expect(existsSync(`${adapter.path}.lock`)).toBe(false);
      await expect(adapter.withExclusiveAccess(async () => {})).resolves.toBeUndefined();
    });
  });

  describe("delete()", () => {
    it("deletes manifest.json from disk", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);

      await adapter.delete();

      expect(await adapter.load()).toBeNull();
    });

    it("never removes the user config dir itself — auth.json, marketplaces.json and references.json live there too", async () => {
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
      const freshAdapter = new UserManifestRepositoryAdapter(() => freshDir, atomicWriteFile);

      await freshAdapter.save(Manifest.create());

      expect(existsSync(join(freshDir, "manifest.json"))).toBe(true);
    });
  });
});
