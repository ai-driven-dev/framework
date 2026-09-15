import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonParseError } from "../../../src/kernel/errors.js";
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

  describe("chmodExecutable()", () => {
    it("makes the file executable", async () => {
      const path = join(tempDir, "run.sh");
      await writeFile(path, "", { mode: 0o644 });

      await fs.chmodExecutable(path);

      expect(await fs.isExecutable(path)).toBe(true);
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

  describe("mergeJsonFile()", () => {
    it("refuses to merge into a file it cannot parse, naming the file", async () => {
      const path = join(tempDir, "settings.json");
      await writeFile(path, "{ not json");

      await expect(fs.mergeJsonFile(path, "{}", "framework-prime")).rejects.toThrow(JsonParseError);
      await expect(fs.mergeJsonFile(path, "{}", "framework-prime")).rejects.toThrow(
        `Cannot parse existing JSON at ${path}: `
      );
    });

    it("drops a prototype key from the incoming content", async () => {
      const path = join(tempDir, "settings.json");
      await writeFile(path, JSON.stringify({ keep: 1 }));

      await fs.mergeJsonFile(path, '{"prototype": {"polluted": true}, "b": 2}', "framework-prime");

      expect(JSON.parse(await readFile(path, "utf-8"))).toStrictEqual({ keep: 1, b: 2 });
    });

    it("replaces a scalar with an incoming array outright", async () => {
      const path = join(tempDir, "settings.json");
      await writeFile(path, JSON.stringify({ list: "one" }));

      await fs.mergeJsonFile(path, '{"list": ["a"]}', "framework-prime");

      expect(JSON.parse(await readFile(path, "utf-8"))).toStrictEqual({ list: ["a"] });
    });

    it("replaces a scalar with an incoming object outright", async () => {
      const path = join(tempDir, "settings.json");
      await writeFile(path, JSON.stringify({ nested: "one" }));

      await fs.mergeJsonFile(path, '{"nested": {"a": 1}}', "framework-prime");

      expect(JSON.parse(await readFile(path, "utf-8"))).toStrictEqual({ nested: { a: 1 } });
    });

    it("replaces an object with an incoming null outright", async () => {
      const path = join(tempDir, "settings.json");
      await writeFile(path, JSON.stringify({ nested: { a: 1 } }));

      await fs.mergeJsonFile(path, '{"nested": null}', "framework-prime");

      expect(JSON.parse(await readFile(path, "utf-8"))).toStrictEqual({ nested: null });
    });
  });
});
