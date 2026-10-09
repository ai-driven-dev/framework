import { chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrivateStorageAdapter } from "../../../src/runtime/filesystem/private-storage-adapter.js";

const posix = process.platform === "win32" ? it.skip : it;
let dir: string;
const storage = new PrivateStorageAdapter();

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "aidd-private-storage-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function mode(path: string): Promise<number> {
  return (await stat(path)).mode & 0o777;
}

describe("a private directory", () => {
  posix("is made readable by its owner alone", async () => {
    const target = join(dir, "a", "ledger");
    await storage.ensureDirectory(target);
    expect(await mode(target)).toBe(0o700);
    expect(await mode(join(dir, "a"))).toBe(0o700);
  });

  posix("is tightened when it already exists with a wider mode", async () => {
    const target = join(dir, "ledger");
    await mkdir(target, { mode: 0o755 });
    await chmod(target, 0o755);
    await storage.ensureDirectory(target);
    expect(await mode(target)).toBe(0o700);
  });

  it("can be ensured twice", async () => {
    await storage.ensureDirectory(join(dir, "x"));
    await expect(storage.ensureDirectory(join(dir, "x"))).resolves.toBeUndefined();
  });
});

describe("replacing a file", () => {
  it("leaves exactly the new content and no temporary file", async () => {
    const path = join(dir, "f.json");
    await writeFile(path, "old");
    await storage.replace(path, "new");
    expect(await readFile(path, "utf8")).toBe("new");
    expect(await readdir(dir)).toEqual(["f.json"]);
  });

  posix("creates a file readable by its owner alone", async () => {
    const path = join(dir, "f.json");
    await storage.replace(path, "x");
    expect(await mode(path)).toBe(0o600);
  });

  it("leaves what was there, and no temporary file, when it cannot write", async () => {
    const path = join(dir, "missing", "f.json");
    await expect(storage.replace(path, "x")).rejects.toThrow();
    expect(await readdir(dir)).toEqual([]);
  });
});

describe("appending to a file", () => {
  it("creates it", async () => {
    const path = join(dir, "a.jsonl");
    await storage.append(path, "one\n");
    expect(await readFile(path, "utf8")).toBe("one\n");
  });

  posix("creates it readable by its owner alone", async () => {
    const path = join(dir, "a.jsonl");
    await storage.append(path, "one\n");
    expect(await mode(path)).toBe(0o600);
  });

  it("adds after what is there", async () => {
    const path = join(dir, "a.jsonl");
    await writeFile(path, "one\n");
    await storage.append(path, "two\n");
    expect(await readFile(path, "utf8")).toBe("one\ntwo\n");
  });

  it("starts a new line when a crash left the last one without its newline", async () => {
    const path = join(dir, "a.jsonl");
    await writeFile(path, '{"torn":');
    await storage.append(path, "two\n");
    expect(await readFile(path, "utf8")).toBe('{"torn":\ntwo\n');
  });

  it("adds nothing before the first line of an empty file", async () => {
    const path = join(dir, "a.jsonl");
    await writeFile(path, "");
    await storage.append(path, "one\n");
    expect(await readFile(path, "utf8")).toBe("one\n");
  });
});
