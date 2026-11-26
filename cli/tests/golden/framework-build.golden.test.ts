/**
 * Keyed `<target>` or `<target>:flat` → { relative-path → SHA-256 }, so it holds on any
 * machine. Re-baselining a cell is deliberate.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { FrameworkBuildMode } from "../../src/contexts/tools/contract/tool-profile.js";
import { translate } from "../../src/contexts/translate/domain/engine.js";
import { BundledSchemaProviderAdapter } from "../../src/contexts/translate/infrastructure/schema-provider.js";
import { AjvSchemaValidatorAdapter } from "../../src/contexts/translate/infrastructure/schema-validator.js";
import { BundledAssetProviderAdapter } from "../../src/shared/infrastructure/asset-loader.js";
import { foldFilesOf } from "../contexts/translate/testing/build-only-folds.builder.js";
import { buildTree } from "../contexts/translate/testing/build-tree.builder.js";
import { distributionOf } from "../contexts/translate/testing/framework-real-distribution.builder.js";
import { CapturingLogger } from "../shared/testing/capturing-logger.fake.js";
import { catalogOf } from "../shared/testing/catalog-of.builder.js";
import { InMemoryFileAdapter } from "../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools } from "../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../shared/testing/seed-from-directory.builder.js";
import { expectGolden } from "./testing/expect-golden.builder.js";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const FRAMEWORK_FIXTURE = join(ROOT, "tests/fixtures/framework-real");
const SNAPSHOT_FILE = join(ROOT, "tests/golden/snapshots/framework-build/golden.json");

type TargetSnapshot = Record<string, string>; // rel-path → sha256
type GoldenSnapshot = Record<string, TargetSnapshot>; // key → files

function storedBaseline(): GoldenSnapshot {
  return JSON.parse(readFileSync(SNAPSHOT_FILE, "utf-8")) as GoldenSnapshot;
}

const MARKETPLACE_TARGETS = ["copilot", "codex", "claude", "cursor", "antigravity"] as const;
const FLAT_TARGETS = catalogOf().idsInCanonicalOrder("ai");
const CELL_COUNT = MARKETPLACE_TARGETS.length + FLAT_TARGETS.length;

const FROZEN_CELLS = new Set<string>([
  ...MARKETPLACE_TARGETS,
  ...FLAT_TARGETS.map((target) => `${target}:flat`),
]);

function canonical(snapshot: TargetSnapshot): string {
  return JSON.stringify(
    Object.keys(snapshot)
      .sort()
      .map((key) => [key, snapshot[key]])
  );
}

function describeDrift(stored: TargetSnapshot, captured: TargetSnapshot): string {
  const keys = new Set([...Object.keys(stored), ...Object.keys(captured)]);
  const moved = [...keys]
    .filter((k) => stored[k] !== captured[k])
    .sort()
    .slice(0, 6)
    .map((k) => {
      if (stored[k] === undefined) return `+${k}`;
      if (captured[k] === undefined) return `-${k}`;
      return `~${k}`;
    });
  return moved.join(", ");
}

const OUT = resolve("/aidd-golden-out").replaceAll("\\", "/");

/** One cell built in memory, as `aidd translate` builds it: the real sink and the real assets. */
async function captureInMemory(
  seeded: InMemoryFileAdapter,
  target: string,
  mode: FrameworkBuildMode
): Promise<TargetSnapshot> {
  const tools = registeredTools();
  const fs = new InMemoryFileAdapter();
  for (const path of seeded.listAll()) fs.setFile(path, seeded.getFile(path) ?? "");
  await fs.createDirectory(OUT);
  const id = tools.aiToolId(target);
  if (id === null) throw new Error(`${target} is not an AI tool`);
  const contract = tools.aiProfile(id).buildContract(mode);
  if (contract === null) throw new Error(`no ${mode} contract for ${target}`);
  const assets = new BundledAssetProviderAdapter(tools);
  const build = buildTree(
    fs,
    new AjvSchemaValidatorAdapter(),
    assets,
    new CapturingLogger(),
    contract,
    mode,
    false,
    new BundledSchemaProviderAdapter()
  );
  await build.execute({ sourceDir: FRAMEWORK_FIXTURE, outDir: OUT, target: id, mode });
  return Object.fromEntries(
    fs
      .listUnder(OUT)
      .map((path): [string, string] => [
        path.slice(OUT.length + 1).replaceAll("\\", "/"),
        createHash("sha256")
          .update(fs.getFile(path) ?? "", "utf-8")
          .digest("hex"),
      ])
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
}

async function captureAllCells(seeded: InMemoryFileAdapter): Promise<GoldenSnapshot> {
  const captured: GoldenSnapshot = {};
  for (const target of MARKETPLACE_TARGETS) {
    captured[target] = await captureInMemory(seeded, target, "marketplace");
  }
  for (const target of FLAT_TARGETS) {
    captured[`${target}:flat`] = await captureInMemory(seeded, target, "flat");
  }
  return captured;
}

describe.concurrent(`Framework build golden - ${CELL_COUNT}-cell matrix`, () => {
  let seeded: InMemoryFileAdapter;
  beforeAll(async () => {
    seeded = new InMemoryFileAdapter();
    await seedFromDirectory(seeded, FRAMEWORK_FIXTURE, { useAbsolutePaths: true });
  });

  it.each([
    ...MARKETPLACE_TARGETS.map((target) => [target, "marketplace"] as const),
    ...FLAT_TARGETS.map((target) => [target, "flat"] as const),
  ])("%s %s built in memory is byte-identical to its stored baseline", async (target, mode) => {
    const stored = storedBaseline();
    const key = mode === "flat" ? `${target}:flat` : target;
    expect(await captureInMemory(seeded, target, mode)).toStrictEqual(stored[key]);
  });

  it.each([
    ...MARKETPLACE_TARGETS.map((target) => [target, "marketplace"] as const),
    ...FLAT_TARGETS.map((target) => [target, "flat"] as const),
  ])(
    "%s %s: the engine's per-plugin files hash to the stored baseline, bar the folded ones",
    (target, mode) => {
      const id = registeredTools().aiToolId(target);
      const contract = id === null ? null : registeredTools().aiProfile(id).buildContract(mode);
      if (contract === null) throw new Error(`no ${mode} contract for ${target}`);
      const plugins = readdirSync(join(FRAMEWORK_FIXTURE, "plugins"));
      const folded = new Set(
        Object.values(foldFilesOf({ target, mode, contract }, plugins)).flat()
      );
      const stored = storedBaseline()[mode === "flat" ? `${target}:flat` : target];
      const listed = plugins.flatMap(
        (name) =>
          translate(distributionOf(seeded, name), { kind: "build", contract, mode, outDir: OUT })
            .files
      );

      expect(listed.length).toBeGreaterThan(0);
      for (const file of listed.filter((f) => !folded.has(f.relativePath))) {
        const hash = createHash("sha256").update(file.content, "utf-8").digest("hex");
        expect(hash, `${target} ${mode} ${file.relativePath}`).toBe(stored[file.relativePath]);
      }
    }
  );

  it("snapshot is deterministic (two captures of each target are byte-identical)", async () => {
    const [snap1, snap2] = [await captureAllCells(seeded), await captureAllCells(seeded)];
    expect(snap1).toStrictEqual(snap2);
  }, 120_000);

  it(`every one of the ${CELL_COUNT} cells is byte-identical to its stored baseline`, async () => {
    const captured = await captureAllCells(seeded);

    await expectGolden(SNAPSHOT_FILE, captured, {
      compare: (stored) => {
        const expectedCells = [...MARKETPLACE_TARGETS, ...FLAT_TARGETS.map((t) => `${t}:flat`)];
        for (const key of expectedCells) {
          expect(stored[key], `stored snapshot missing cell: ${key}`).toBeDefined();
          expect(Object.keys(stored[key]).length, `cell ${key} must have files`).toBeGreaterThan(0);
        }

        // Every mismatching cell at once, compared as sorted entries: key order follows the
        // platform's directory listing, the fact under test is which files exist and hash to what.
        const drifted = [...FROZEN_CELLS].filter(
          (key) => canonical(captured[key] ?? {}) !== canonical(stored[key] ?? {})
        );
        const detail = drifted
          .map((key) => `${key}: ${describeDrift(stored[key] ?? {}, captured[key] ?? {})}`)
          .join("\n");
        expect(drifted, `cells differing from their stored baseline\n${detail}`).toEqual([]);
        for (const key of FROZEN_CELLS) {
          expect(captured[key], `cell ${key}`).toStrictEqual(stored[key]);
        }
      },
    });
  }, 120_000);

  it("the stored baseline holds a cell for every tool the CLI builds for, and nothing else", () => {
    const stored = storedBaseline();
    const expectedCells = [...MARKETPLACE_TARGETS, ...FLAT_TARGETS.map((t) => `${t}:flat`)];
    expect(Object.keys(stored).sort()).toEqual([...expectedCells].sort());
    for (const key of expectedCells) {
      expect(Object.keys(stored[key]).length, `cell ${key} must have files`).toBeGreaterThan(0);
    }
  });
});
