import { mkdir, mkdtemp, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { modifiedAtIfPresent, readTextIfPresent } from "../../src/kernel/reading/text-file.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "aidd-text-file-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("reading a file that may not be there", () => {
  it("returns its text", async () => {
    await writeFile(join(dir, "a.txt"), "hello");
    expect(await readTextIfPresent(join(dir, "a.txt"))).toBe("hello");
  });

  it("returns null for a file that does not exist", async () => {
    expect(await readTextIfPresent(join(dir, "missing"))).toBeNull();
  });

  it("returns null when a parent of the path is a file", async () => {
    await writeFile(join(dir, "plain"), "x");
    expect(await readTextIfPresent(join(dir, "plain", "child"))).toBeNull();
  });

  it("throws for a failure that is not absence", async () => {
    await mkdir(join(dir, "folder"));
    await expect(readTextIfPresent(join(dir, "folder"))).rejects.toThrow();
  });
});

describe("when a file that may not be there was last written", () => {
  it("returns its modification time", async () => {
    await writeFile(join(dir, "a.txt"), "x");
    await utimes(join(dir, "a.txt"), new Date(1_700_000_000_000), new Date(1_700_000_000_000));
    expect(await modifiedAtIfPresent(join(dir, "a.txt"))).toBe(1_700_000_000_000);
  });

  it("returns null for a file that does not exist, or whose parent is a file", async () => {
    expect(await modifiedAtIfPresent(join(dir, "missing"))).toBeNull();
    await writeFile(join(dir, "plain"), "x");
    expect(await modifiedAtIfPresent(join(dir, "plain", "child"))).toBeNull();
  });

  it("throws for a failure that is not absence", async () => {
    const loop = join(dir, "loop");
    await symlink(loop, loop);
    await expect(modifiedAtIfPresent(loop)).rejects.toThrow();
  });
});
