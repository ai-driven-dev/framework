import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expectGolden } from "./expect-golden.js";

describe("expectGolden", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "expect-golden-"));
    file = join(dir, "nested", "golden.json");
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("compares the actual value to the stored file when the update variable is unset", async () => {
    await writeFile(join(dir, "stored.json"), `${JSON.stringify({ a: 1 }, null, 2)}\n`);

    await expectGolden(join(dir, "stored.json"), { a: 1 }, {});
    await expect(expectGolden(join(dir, "stored.json"), { a: 2 }, {})).rejects.toThrow();
  });

  it("writes the actual value as indented JSON with a final newline when the variable is 1", async () => {
    await expectGolden(file, { a: [1] }, { UPDATE_GOLDEN: "1" });

    expect(await readFile(file, "utf-8")).toBe(`${JSON.stringify({ a: [1] }, null, 2)}\n`);
  });

  it("refuses to regenerate when CI is set", async () => {
    await expect(expectGolden(file, { a: 1 }, { UPDATE_GOLDEN: "1", CI: "true" })).rejects.toThrow(
      /CI/
    );
    await expect(readFile(file, "utf-8")).rejects.toThrow();
  });
});
