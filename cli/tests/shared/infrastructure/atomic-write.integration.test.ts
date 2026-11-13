import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PlatformAdapter } from "../../../src/contexts/framework/infrastructure/platform-adapter.js";
import { atomicWriteFile } from "../../../src/shared/infrastructure/atomic-write.js";

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

describe("PlatformAdapter", () => {
  it("answers the platform this process runs on", () => {
    expect(new PlatformAdapter().current()).toBe(process.platform);
  });
});
