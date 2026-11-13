import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { HasherAdapter } from "../../../../src/contexts/framework/infrastructure/hasher-adapter.js";
import { JsonFileMergerAdapter } from "../../../../src/contexts/framework/infrastructure/json-file-merger-adapter.js";
import { FileAdapter } from "../../../../src/shared/infrastructure/file-adapter.js";

it("merges the incoming keys into the file on disk, the framework's value winning a conflict", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aidd-merger-"));
  try {
    const fs = new JsonFileMergerAdapter(new FileAdapter(new HasherAdapter()));
    const path = join(dir, "settings.json");
    await fs.writeFile(path, JSON.stringify({ kept: "user", shared: "user" }));

    await fs.mergeJsonFile(path, JSON.stringify({ shared: "framework" }), "framework-prime");

    expect(JSON.parse(await readFile(path, "utf-8"))).toStrictEqual({
      kept: "user",
      shared: "framework",
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
