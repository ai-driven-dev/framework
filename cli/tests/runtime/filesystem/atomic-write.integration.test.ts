import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { atomicWriteFile } from "../../../src/runtime/filesystem/atomic-write.js";
import { HasherAdapter } from "../../../src/runtime/filesystem/hasher-adapter.js";
import { PlatformAdapter } from "../../../src/runtime/platform/platform-adapter.js";

describe("atomicWriteFile", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-atomic-write-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("leaves exactly the file, holding the content as UTF-8", async () => {
    const path = join(tempDir, "out.txt");

    await atomicWriteFile(path, "héllo");

    expect(await readdir(tempDir)).toStrictEqual(["out.txt"]);
    expect(await readFile(path, "utf-8")).toBe("héllo");
  });
});

describe("HasherAdapter", () => {
  it("hashes the UTF-8 bytes of the content", () => {
    expect(new HasherAdapter().hash("héllo").value).toBe("be50e8478cf24ff3595bc7307fb91b50");
  });
});

describe("PlatformAdapter", () => {
  it("answers the platform this process runs on", () => {
    expect(new PlatformAdapter().current()).toBe(process.platform);
  });
});
