import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Vitest } from "vitest/node";
import ordinary from "../../vitest.config.js";
import mutation from "../../vitest.mutation.config.js";
import { CheapestKillerFirst, mutationOrder } from "./mutation-sequencer.js";

const spec = (project: string, moduleId: string) => ({ project: { name: project }, moduleId });
const SIZES: Record<string, number> = {
  "/t/big.integration.test.ts": 900,
  "/t/small.integration.test.ts": 10,
  "/t/big.unit.test.ts": 800,
  "/t/small.unit.test.ts": 20,
  "/t/a-twin.unit.test.ts": 20,
};
const sizeOf = (path: string) => SIZES[path] ?? 0;
const ids = (specs: readonly { moduleId: string }[]) => specs.map((s) => s.moduleId);

describe("the order a mutant runs its test files in", () => {
  it("runs every unit file before any integration file, the smallest first, then by path", () => {
    const specs = [
      spec("integration", "/t/big.integration.test.ts"),
      spec("unit", "/t/big.unit.test.ts"),
      spec("integration", "/t/small.integration.test.ts"),
      spec("unit", "/t/small.unit.test.ts"),
      spec("unit", "/t/a-twin.unit.test.ts"),
    ];
    expect(ids(mutationOrder(specs, sizeOf))).toStrictEqual([
      "/t/a-twin.unit.test.ts",
      "/t/small.unit.test.ts",
      "/t/big.unit.test.ts",
      "/t/small.integration.test.ts",
      "/t/big.integration.test.ts",
    ]);
  });

  it("puts a project it does not know last", () => {
    const specs = [spec("other", "/t/small.unit.test.ts"), spec("unit", "/t/big.unit.test.ts")];
    expect(ids(mutationOrder(specs, sizeOf))).toStrictEqual([
      "/t/big.unit.test.ts",
      "/t/small.unit.test.ts",
    ]);
  });

  it("orders every mutation run, and only mutation runs", () => {
    expect(mutation.test?.sequence?.sequencer).toBe(CheapestKillerFirst);
    expect(ordinary.test?.sequence?.sequencer).toBeUndefined();
  });

  it("is what Vitest calls: it reads each file's size from disk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "aidd-sequencer-"));
    try {
      const big = join(dir, "big.unit.test.ts");
      const small = join(dir, "small.unit.test.ts");
      writeFileSync(big, "x".repeat(200));
      writeFileSync(small, "x".repeat(10));
      const specs = [spec("unit", big), spec("unit", small)];
      const sorted = await new CheapestKillerFirst({} as Vitest).sort(specs);
      expect(ids(sorted)).toStrictEqual([small, big]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
