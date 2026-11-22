import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LeftOutAdapter } from "../../../../../../src/contexts/telemetry/infrastructure/storage/ledger/left-out-adapter.js";
import { PrivateStorageAdapter } from "../../../../../../src/shared/infrastructure/private-storage-adapter.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "aidd-left-out-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const adapter = () => new LeftOutAdapter(join(dir, "left-out"), dir, new PrivateStorageAdapter());

describe("what was left out", () => {
  it("counts nothing before anything is added, and creates no file", async () => {
    expect(await adapter().counts()).toStrictEqual({
      undated: 0,
      unrecognised: 0,
      requestless: 0,
    });
    await expect(readFile(join(dir, "left-out"), "utf8")).rejects.toThrow();
  });

  it("counts each thing once per reason, however often it is added", async () => {
    await adapter().add([
      { reason: "undated", of: "a" },
      { reason: "undated", of: "b" },
      { reason: "requestless", of: "a" },
    ]);
    await adapter().add([{ reason: "undated", of: "a" }]);
    expect(await adapter().counts()).toStrictEqual({
      undated: 2,
      unrecognised: 0,
      requestless: 1,
    });
  });

  it("keeps one line per entry, in text order, and keeps no name in clear", async () => {
    await adapter().add([
      { reason: "unrecognised", of: "secret-name" },
      { reason: "undated", of: "secret-name" },
    ]);
    const lines = (await readFile(join(dir, "left-out"), "utf8")).split("\n").filter(Boolean);
    expect(lines.map((line) => line.split(" ")[0])).toStrictEqual(["undated", "unrecognised"]);
    expect(lines.join("")).not.toContain("secret-name");
  });

  it("keeps a line this version does not know and does not count it", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(dir, "left-out"), "future abc\n");
    await adapter().add([{ reason: "undated", of: "a" }]);
    expect(await readFile(join(dir, "left-out"), "utf8")).toContain("future abc\n");
    expect(await adapter().counts()).toStrictEqual({
      undated: 1,
      unrecognised: 0,
      requestless: 0,
    });
  });
});
