import { chmod, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, rename: vi.fn(actual.rename) };
});

import { FileAdapter } from "../../../../src/shared/infrastructure/filesystem/file-adapter.js";
import { HasherAdapter } from "../../../../src/shared/infrastructure/filesystem/hasher-adapter.js";
import { CapturingLogger } from "../../../helpers/ports/capturing-logger.js";

// What the file port contract cannot observe stays here: the rename step, the stop at a
// directory the filesystem refuses to remove, and what the adapter tells its logger.
describe("FileAdapter", () => {
  let tempDir: string;
  let fs: FileAdapter;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-fs-adapter-"));
    fs = new FileAdapter(new HasherAdapter());
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("writeFile()", () => {
    // A crash mid-write must never leave a truncated file at `path`, and two concurrent `aidd
    // setup` runs both write `references.json`: `rename` is the one POSIX-atomic step.
    it("writes through a temporary file and renames it into place", async () => {
      const path = join(tempDir, "atomic.txt");
      await writeFile(path, "old content", "utf-8");
      vi.mocked(rename).mockClear();

      await fs.writeFile(path, "new content");

      expect(rename).toHaveBeenCalledTimes(1);
      const [renamedFrom, renamedTo] = vi.mocked(rename).mock.calls[0] as [string, string];
      expect(renamedTo).toBe(path);
      expect(renamedFrom).not.toBe(path);
      expect(await readFile(path, "utf-8")).toBe("new content");
    });
  });

  describe("deleteEmptyDirectories()", () => {
    it("stops when directory is not empty", async () => {
      const outer = join(tempDir, "outer2");
      const inner = join(outer, "inner");
      const sibling = join(outer, "sibling.txt");
      await mkdir(inner, { recursive: true });
      await writeFile(sibling, "content", "utf-8");

      await fs.deleteEmptyDirectories(inner);
      expect(await fs.fileExists(inner)).toBe(false);
      expect(await fs.fileExists(outer)).toBe(true);
    });
  });
});

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

  describe("isExecutable()", () => {
    it.skipIf(process.platform === "win32")(
      "tells a file its owner may run from one it may not, and from one that is absent",
      async () => {
        const runnable = join(tempDir, "runnable");
        const plain = join(tempDir, "plain");
        await writeFile(runnable, "#!/bin/sh\n");
        await writeFile(plain, "#!/bin/sh\n");
        await chmod(runnable, 0o755);
        await chmod(plain, 0o644);

        expect(await fs.isExecutable(runnable)).toBe(true);
        expect(await fs.isExecutable(plain)).toBe(false);
        expect(await fs.isExecutable(join(tempDir, "absent"))).toBe(false);
      }
    );
  });

  describe("mergeJsonFile()", () => {
    it("merges the incoming keys into the file on disk, the framework's value winning a conflict", async () => {
      const path = join(tempDir, "nested", "settings.json");
      await fs.writeFile(path, JSON.stringify({ kept: "user", shared: "user" }));

      await fs.mergeJsonFile(
        path,
        JSON.stringify({ added: "framework", shared: "framework" }),
        "framework-prime"
      );

      expect(JSON.parse(await readFile(path, "utf-8"))).toStrictEqual({
        kept: "user",
        shared: "framework",
        added: "framework",
      });
    });
  });
});
