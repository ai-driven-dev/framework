import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformAdapter } from "../../../src/contexts/installation/infrastructure/platform-adapter.js";
import { atomicWriteFile } from "../../../src/shared/infrastructure/atomic-write.js";

vi.mock("node:crypto", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:crypto")>()),
  randomBytes: () => Buffer.from("fixed!"),
}));

describe("writing a file atomically", () => {
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

  it("refuses to write through a temporary file that already exists", async () => {
    const path = join(tempDir, "out.txt");
    const taken = `${path}.666978656421.tmp`;
    await writeFile(taken, "someone else's");

    await expect(atomicWriteFile(path, "mine")).rejects.toMatchObject({ code: "EEXIST" });

    expect(await readFile(taken, "utf-8")).toBe("someone else's");
  });
});

describe("asking for the running platform", () => {
  it("answers the platform this process runs on", () => {
    expect(new PlatformAdapter().current()).toBe(process.platform);
  });
});
