import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, rename: vi.fn(actual.rename) };
});

import { FileAdapter } from "../../../src/runtime/filesystem/file-adapter.js";
import { HasherAdapter } from "../../../src/runtime/filesystem/hasher-adapter.js";

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
    it("writes file content", async () => {
      const path = join(tempDir, "test.txt");
      await fs.writeFile(path, "hello");
      const content = await readFile(path, "utf-8");
      expect(content).toBe("hello");
    });

    it("creates parent directories recursively", async () => {
      const path = join(tempDir, "a", "b", "c", "test.txt");
      await fs.writeFile(path, "nested");
      const content = await readFile(path, "utf-8");
      expect(content).toBe("nested");
    });

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

  describe("readFile()", () => {
    it("reads and provides file content as string", async () => {
      const path = join(tempDir, "read.txt");
      await writeFile(path, "content to read", "utf-8");
      const result = await fs.readFile(path);
      expect(result).toBe("content to read");
    });
  });

  describe("deleteFile()", () => {
    it("removes an existing file", async () => {
      const path = join(tempDir, "to-delete.txt");
      await writeFile(path, "data", "utf-8");
      await fs.deleteFile(path);
      expect(await fs.fileExists(path)).toBe(false);
    });

    it("handles missing file gracefully", async () => {
      const path = join(tempDir, "nonexistent.txt");
      await expect(fs.deleteFile(path)).resolves.toBeUndefined();
    });
  });

  describe("createDirectory()", () => {
    it("creates directory recursively", async () => {
      const path = join(tempDir, "x", "y", "z");
      await fs.createDirectory(path);
      expect(await fs.fileExists(path)).toBe(true);
    });
  });

  describe("deleteEmptyDirectories()", () => {
    it("removes empty directory", async () => {
      const dir = join(tempDir, "empty");
      await mkdir(dir);
      await fs.deleteEmptyDirectories(dir);
      expect(await fs.fileExists(dir)).toBe(false);
    });

    it("removes chain of empty directories", async () => {
      const inner = join(tempDir, "outer", "inner");
      await mkdir(inner, { recursive: true });
      await fs.deleteEmptyDirectories(inner);
      expect(await fs.fileExists(join(tempDir, "outer"))).toBe(false);
    });

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

  describe("listDirectory()", () => {
    it("lists all files recursively with relative paths", async () => {
      await fs.writeFile(join(tempDir, "a.txt"), "a");
      await fs.writeFile(join(tempDir, "sub", "b.txt"), "b");
      await fs.writeFile(join(tempDir, "sub", "deep", "c.txt"), "c");

      const files = await fs.listDirectory(tempDir);
      expect(files).toContain("a.txt");
      // `listDirectory()` normalizes every relative path to "/" — what a manifest read on every
      // platform stores — so the expectation is the POSIX literal, never `join()`.
      expect(files).toContain("sub/b.txt");
      expect(files).toContain("sub/deep/c.txt");
    });
  });

  describe("fileExists()", () => {
    it("confirms an existing file is found", async () => {
      const path = join(tempDir, "exists.txt");
      await writeFile(path, "", "utf-8");
      expect(await fs.fileExists(path)).toBe(true);
    });

    it("confirms a missing file is not found", async () => {
      expect(await fs.fileExists(join(tempDir, "missing.txt"))).toBe(false);
    });

    it("confirms an existing directory is found", async () => {
      expect(await fs.fileExists(tempDir)).toBe(true);
    });
  });

  describe("readFileHash()", () => {
    it("returns hash of file content", async () => {
      const path = join(tempDir, "hash-me.txt");
      await writeFile(path, "hashable content", "utf-8");
      const hash = await fs.readFileHash(path);
      expect(hash.value).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe("listDirectory() — symlink security", () => {
    it("skips symbolic links and does not read their content", async () => {
      const real = join(tempDir, "real-file.txt");
      const outside = join(tempDir, "secret.txt");
      const skillsDir = join(tempDir, "skills");
      const linkPath = join(skillsDir, "secret-link.txt");
      const normalFile = join(skillsDir, "normal.md");

      await writeFile(real, "real content", "utf-8");
      await writeFile(outside, "secret content", "utf-8");
      await mkdir(skillsDir, { recursive: true });
      await symlink(outside, linkPath);
      await writeFile(normalFile, "normal content", "utf-8");

      const files = await fs.listDirectory(tempDir);

      const posixFiles = files.map((f) => f.split("\\").join("/"));
      expect(posixFiles).not.toContain("skills/secret-link.txt");

      expect(posixFiles.some((f) => f.includes("normal"))).toBe(true);
    });
  });
});
