import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expectGolden } from "./testing/expect-golden.builder.js";

describe("comparing against a golden", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "expect-golden-"));
    file = join(dir, "nested", "golden.json");
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("compares the actual value to the stored file when the update variable is unset", async () => {
    await writeFile(join(dir, "stored.json"), `${JSON.stringify({ a: 1 }, null, 2)}\n`);

    await expectGolden(join(dir, "stored.json"), { a: 1 }, { env: {} });
    await expect(expectGolden(join(dir, "stored.json"), { a: 2 }, { env: {} })).rejects.toThrow();
  });

  it("hands the stored value to the given comparison instead of the default equality", async () => {
    await writeFile(join(dir, "stored.json"), JSON.stringify({ a: 1 }));
    const seen: unknown[] = [];

    await expectGolden(
      join(dir, "stored.json"),
      { a: 2 },
      { env: {}, compare: (s) => seen.push(s) }
    );

    expect(seen).toEqual([{ a: 1 }]);
  });

  it("writes the actual value as indented JSON with a final newline when the variable is 1", async () => {
    await expectGolden(file, { a: [1] }, { env: { UPDATE_GOLDEN: "1" } });

    expect(await readFile(file, "utf-8")).toBe(`${JSON.stringify({ a: [1] }, null, 2)}\n`);
  });

  it("refuses to regenerate when CI is set", async () => {
    await expect(
      expectGolden(file, { a: 1 }, { env: { UPDATE_GOLDEN: "1", CI: "true" } })
    ).rejects.toThrow(/CI/);
    await expect(readFile(file, "utf-8")).rejects.toThrow();
  });
});
