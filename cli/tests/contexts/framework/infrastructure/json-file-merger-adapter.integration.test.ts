import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HasherAdapter } from "../../../../src/contexts/framework/infrastructure/hasher-adapter.js";
import { JsonFileMergerAdapter } from "../../../../src/contexts/framework/infrastructure/json-file-merger-adapter.js";
import { FileAdapter } from "../../../../src/shared/infrastructure/file-adapter.js";

describe("JsonFileMergerAdapter", () => {
  let tempDir: string;
  let fs: JsonFileMergerAdapter;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-merger-"));
    fs = new JsonFileMergerAdapter(new FileAdapter(new HasherAdapter()));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

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
