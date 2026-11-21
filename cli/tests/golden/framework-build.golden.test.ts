/**
 * Keyed `<target>` or `<target>:flat` → { relative-path → SHA-256 }, so it holds on any
 * machine. Re-baselining a cell is deliberate.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FrameworkBuildMode } from "../../src/contexts/tools/contract/tool-profile.js";
import { AjvSchemaValidatorAdapter } from "../../src/contexts/translate/infrastructure/schema-validator.js";
import { BundledAssetProviderAdapter } from "../../src/shared/infrastructure/asset-loader.js";
import { buildTree } from "../contexts/translate/testing/build-tree.builder.js";
import { CapturingLogger } from "../shared/testing/capturing-logger.fake.js";
import { catalogOf } from "../shared/testing/catalog-of.builder.js";
import { InMemoryFileAdapter } from "../shared/testing/in-memory-file-adapter.fake.js";
import { runInProcess } from "../shared/testing/in-process-cli.builder.js";
import { registeredTools } from "../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../shared/testing/seed-from-directory.builder.js";
import { expectGolden } from "./testing/expect-golden.builder.js";
import { twoCaptures } from "./testing/two-captures.builder.js";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const FRAMEWORK_FIXTURE = join(ROOT, "tests/fixtures/framework-real");
const SNAPSHOT_FILE = join(ROOT, "tests/golden/snapshots/framework-build/golden.json");

type TargetSnapshot = Record<string, string>; // rel-path → sha256
type GoldenSnapshot = Record<string, TargetSnapshot>; // key → files

function storedBaseline(): GoldenSnapshot {
  return JSON.parse(readFileSync(SNAPSHOT_FILE, "utf-8")) as GoldenSnapshot;
}

const MARKETPLACE_TARGETS = ["copilot", "codex", "claude", "cursor"] as const;
const FLAT_TARGETS = catalogOf().idsInCanonicalOrder("ai");
const CELL_COUNT = MARKETPLACE_TARGETS.length + FLAT_TARGETS.length;

const FROZEN_CELLS = new Set<string>([
  ...MARKETPLACE_TARGETS,
  ...FLAT_TARGETS.map((target) => `${target}:flat`),
]);

// A Windows checkout's core.autocrlf writes CRLF, which would diff against the LF-committed
// baseline on line endings alone; content that is not UTF-8 is hashed raw instead.
function normalizeLineEndings(content: Buffer): Buffer {
  const text = content.toString("utf-8");
  if (Buffer.byteLength(text, "utf-8") !== content.length) return content;
  return Buffer.from(text.replace(/\r\n/g, "\n"), "utf-8");
}

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

async function hashDirectory(dir: string): Promise<TargetSnapshot> {
  const result: TargetSnapshot = {};
  const entries = await readdir(dir, { recursive: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    // biome-ignore lint/plugin: hashing a tree skips directories and vanished entries
    try {
      const content = await readFile(fullPath);
      const normalized = normalizeLineEndings(content);
      result[entry.replace(/\\/g, "/")] = createHash("sha256").update(normalized).digest("hex");
    } catch {
      // skip directories
    }
  }
  return Object.fromEntries(
    Object.entries(result).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
}

async function captureTarget(
  target: string,
  flat: boolean,
  projectDir: string,
  fakeHome: string,
  tempDir: string
): Promise<TargetSnapshot> {
  const key = flat ? `${target}:flat` : target;
  const outDir = join(tempDir, `dist-${key.replace(":", "-")}`);
  await mkdir(outDir, { recursive: true });
  const args = ["translate", FRAMEWORK_FIXTURE, "--to", target, "--out", outDir];
  if (flat) args.push("--as", "flat");
  const result = await runInProcess(args, { cwd: projectDir, home: fakeHome });
  if (result.exitCode !== 0) {
    throw new Error(`translate --to ${target}${flat ? " --as flat" : ""} failed: ${result.stderr}`);
  }
  const report = flat ? "Flat-installed" : "Built";
  expect(result.stdout, `translate --to ${key} reports the build`).toContain(report);
  return hashDirectory(outDir);
}

async function captureAllCells(
  projectDir: string,
  fakeHome: string,
  tempDir: string
): Promise<GoldenSnapshot> {
  const captured: GoldenSnapshot = {};
  for (const target of MARKETPLACE_TARGETS) {
    captured[target] = await captureTarget(target, false, projectDir, fakeHome, tempDir);
  }
  for (const target of FLAT_TARGETS) {
    captured[`${target}:flat`] = await captureTarget(target, true, projectDir, fakeHome, tempDir);
  }
  return captured;
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
    mode
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

const captures = twoCaptures("fb-golden-det", (env) =>
  captureAllCells(env.projectDir, env.fakeHome, env.tempDir)
);

describe.concurrent(`Framework build golden - ${CELL_COUNT}-cell matrix`, () => {
  afterAll(captures.cleanup);

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

  // Two full builds of every cell measured just past the 60s default on a Windows runner, not a
  // hang. Raised per test so no other e2e file's budget moves.
  it("snapshot is deterministic (two captures of each target are byte-identical)", async () => {
    const snap1 = await captures.first();
    const snap2 = await captures.second();
    for (const target of MARKETPLACE_TARGETS) {
      expect(snap1[target], `target ${target}: capture 1 vs 2 differ`).toStrictEqual(snap2[target]);
    }
    for (const target of FLAT_TARGETS) {
      const key = `${target}:flat`;
      expect(snap1[key], `${target}:flat capture 1 vs 2 differ`).toStrictEqual(snap2[key]);
    }
  }, 120_000);

  it(`every one of the ${CELL_COUNT} cells is byte-identical to its stored baseline`, async () => {
    const captured = await captures.first();

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
