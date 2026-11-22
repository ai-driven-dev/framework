import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  describe("loading a manifest that may be unreadable", () => {
    it("answers the manifest when it is readable", async () => {
      await adapter.save(Manifest.create());

      expect(await adapter.loadIfReadable()).not.toBeNull();
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
      const second = new UserManifestRepositoryAdapter(
        () => userConfigDir,
        manifestFileDeps(() => userConfigDir)
      );
      let release = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let ready = () => {};
      const firstReady = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const firstMutation = adapter.withExclusiveAccess(async () => {
        const manifest = (await adapter.load()) ?? Manifest.create();
        manifest.addTool(TOOL.cursor, "1.0.0", []);
        await adapter.save(manifest);
        ready();
        await held;
      });
      let secondEntered = false;
      let secondMutation: Promise<void> | undefined;
      try {
        await Promise.race([firstReady, firstMutation]);
        expect(existsSync(`${adapter.path}.lock`)).toBe(true);
        secondMutation = second.withExclusiveAccess(async () => {
          secondEntered = true;
          const manifest = (await second.load()) ?? Manifest.create();
          manifest.addTool(TOOL.codex, "1.0.0", []);
          await second.save(manifest);
        });
        await pause(150);
        expect(secondEntered).toBe(false);
      } finally {
        release();
        await Promise.all([firstMutation, secondMutation]);
      }
      expect((await adapter.load())?.getInstalledToolIds()).toEqual(["cursor", "codex"]);
      expect(existsSync(`${adapter.path}.lock`)).toBe(false);
    });

    it("keeps the old JSON and releases the lock when the atomic writer fails", async () => {
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
      await expect(failing.withExclusiveAccess(() => failing.save(replacement))).rejects.toThrow(
        "write failed before rename"
      );
      expect((await adapter.load())?.getInstalledToolIds()).toEqual(["cursor"]);
      expect(existsSync(`${adapter.path}.lock`)).toBe(false);
      await expect(adapter.withExclusiveAccess(async () => {})).resolves.toBeUndefined();
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
