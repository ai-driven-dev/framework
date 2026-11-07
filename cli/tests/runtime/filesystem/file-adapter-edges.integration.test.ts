import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileAdapter } from "../../../src/runtime/filesystem/file-adapter.js";
import { HasherAdapter } from "../../../src/runtime/filesystem/hasher-adapter.js";
import { CapturingLogger } from "../../helpers/ports/capturing-logger.js";

describe("FileAdapter, at the edges", () => {
  let tempDir: string;
  let logger: CapturingLogger;
  let fs: FileAdapter;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-fs-edges-"));
    logger = new CapturingLogger();
    fs = new FileAdapter(new HasherAdapter(), logger);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("listFilesRecursive()", () => {
    it("lists every file below the directory by absolute path", async () => {
      await mkdir(join(tempDir, "a", "b"), { recursive: true });
      await writeFile(join(tempDir, "a", "one.txt"), "");
      await writeFile(join(tempDir, "a", "b", "two.txt"), "");

      expect((await fs.listFilesRecursive(join(tempDir, "a"))).sort()).toStrictEqual([
        join(tempDir, "a", "b", "two.txt"),
        join(tempDir, "a", "one.txt"),
      ]);
    });

    it("answers nothing for a directory that is not there", async () => {
      expect(await fs.listFilesRecursive(join(tempDir, "gone"))).toStrictEqual([]);
    });

    it("skips a symlink and says which one", async () => {
      await writeFile(join(tempDir, "real.txt"), "");
      await symlink(join(tempDir, "real.txt"), join(tempDir, "link.txt"));

      expect(await fs.listFilesRecursive(tempDir)).toStrictEqual([join(tempDir, "real.txt")]);
      expect(logger.warnMessages).toStrictEqual([`Skipping symlink: ${join(tempDir, "link.txt")}`]);
    });
  });

  describe("listFilesRecursive(), with no logger", () => {
    it("still skips the symlink, silently", async () => {
      await writeFile(join(tempDir, "real.txt"), "");
      await symlink(join(tempDir, "real.txt"), join(tempDir, "link.txt"));

      expect(await new FileAdapter(new HasherAdapter()).listFilesRecursive(tempDir)).toStrictEqual([
        join(tempDir, "real.txt"),
      ]);
    });
  });

  describe("listDirectory()", () => {
    it("says which symlink it skipped", async () => {
      await writeFile(join(tempDir, "real.txt"), "");
      await symlink(join(tempDir, "real.txt"), join(tempDir, "link.txt"));

      await fs.listDirectory(tempDir);

      expect(logger.warnMessages).toStrictEqual([`Skipping symlink: ${join(tempDir, "link.txt")}`]);
    });
  });

  describe("deleteEmptyDirectories()", () => {
    it("copes with a directory that is not there", async () => {
      await expect(fs.deleteEmptyDirectories(join(tempDir, "gone"))).resolves.toBeUndefined();
    });

    // A read-only directory blocks removal on POSIX alone, and never for root.
    it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
      "stops at a directory it cannot remove",
      async () => {
        const locked = join(tempDir, "locked");
        const inner = join(locked, "inner");
        await mkdir(inner, { recursive: true });
        await chmod(locked, 0o555);
        try {
          await fs.deleteEmptyDirectories(inner);
          expect(await fs.fileExists(inner)).toBe(true);
        } finally {
          await chmod(locked, 0o755);
        }
      }
    );
  });
});
