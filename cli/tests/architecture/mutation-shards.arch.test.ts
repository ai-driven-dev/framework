import { describe, expect, it } from "vitest";
import { legsOf } from "../../scripts/mutation-scopes-to-run.mjs";
import {
  aggregateVerdict,
  inScope,
  mergeReports,
  partition,
  scopeFiles,
  shardFiles,
} from "../../scripts/mutation-shards.mjs";
import { parseShard, scoreOf, shardConfig } from "../../scripts/run-mutation.mjs";
import { read, sourceFiles } from "./helpers.js";

const scopes = (JSON.parse(read("mutation-scopes.json")) as { scopes: Record<string, Scope> })
  .scopes;

interface Scope {
  readonly mutate: string | readonly string[];
  readonly break: number;
  readonly shards?: number;
}

const sharded = Object.entries(scopes).filter(([, scope]) => (scope.shards ?? 1) > 1);

describe("splitting a scope into shards", () => {
  it("declares shards only where a scope is worth splitting, never on the canary", () => {
    expect(sharded.map(([name]) => name).sort()).toEqual([
      "framework",
      "kernel",
      "telemetry",
      "tools",
      "tools-codex",
      "translate",
    ]);
    expect(scopes.canary?.shards).toBeUndefined();
  });

  it.each(sharded)("partitions %s: every file once, in exactly one shard", (_name, scope) => {
    const all = scopeFiles(scope.mutate, sourceFiles());
    const of = scope.shards ?? 1;
    const parts = Array.from({ length: of }, (_, i) =>
      shardFiles(scope.mutate, sourceFiles(), i + 1, of)
    );
    expect(parts.flat().sort()).toEqual(all);
    expect(new Set(parts.flat()).size).toBe(all.length);
    for (const part of parts) expect(part.length).toBeGreaterThan(0);
  });

  it("balances the shards by weight, the same way on every run", () => {
    const weights: Record<string, number> = {
      "src/a/h.ts": 9,
      "src/a/m.ts": 5,
      "src/a/n.ts": 4,
      "src/a/l.ts": 1,
    };
    const cut = () =>
      partition("src/a/**/*.ts", Object.keys(weights), 2, (path) => weights[path] ?? 0);
    expect(cut()).toEqual([
      ["src/a/h.ts", "src/a/l.ts"],
      ["src/a/m.ts", "src/a/n.ts"],
    ]);
    expect(cut()).toEqual(cut());
  });

  it.each(sharded)(
    "keeps the heaviest shard of %s within a quarter of its fair share, or its heaviest file",
    (name, scope) => {
      const of = scope.shards ?? 1;
      const parts = partition(scope.mutate, sourceFiles(), of);
      const weight = (files: string[]) =>
        files.reduce((sum, file) => sum + read(file).split("\n").length, 0);
      const fair = weight(parts.flat()) / of;
      const heaviestFile = Math.max(...parts.flat().map((file) => weight([file])));
      expect(Math.max(...parts.map(weight)), name).toBeLessThanOrEqual(
        Math.max(1.25 * fair, heaviestFile)
      );
    }
  );

  it("honours a ! glob, as the scope does", () => {
    const mutate = ["src/t/**/*.ts", "!src/t/p/**/*.ts"];
    expect(inScope(mutate, "src/t/a.ts")).toBe(true);
    expect(inScope(mutate, "src/t/p/b.ts")).toBe(false);
  });
});

describe("running the CI legs", () => {
  it("gives a sharded scope one leg per shard, and any other scope one leg", () => {
    const declared = { a: { mutate: "x", break: 1 }, b: { mutate: "y", break: 1, shards: 3 } };
    expect(legsOf(["a", "b"], declared)).toEqual([
      { scope: "a", shard: 1, of: 1 },
      { scope: "b", shard: 1, of: 3 },
      { scope: "b", shard: 2, of: 3 },
      { scope: "b", shard: 3, of: 3 },
    ]);
  });
});

const mutant = (status: string) => ({ status, mutatorName: "m", location: { start: { line: 1 } } });
const report = (files: Record<string, string[]>) => ({
  files: Object.fromEntries(
    Object.entries(files).map(([name, statuses]) => [name, { mutants: statuses.map(mutant) }])
  ),
});

describe("scoring a sharded scope once, over every shard", () => {
  const mutate = "src/a/**/*.ts";
  const files = ["src/a/x.ts", "src/a/y.ts", "src/a/z.ts", "src/a/w.ts"];
  const of = 2;
  const weightOf = () => 1;
  const shard = (i: number) => {
    const assigned = shardFiles(mutate, files, i, of, weightOf);
    return {
      manifest: { shard: i, of, files: assigned },
      report: report(Object.fromEntries(assigned.map((file) => [file, ["Killed", "Survived"]]))),
    };
  };

  it("merges the shards into the report one run would have written", () => {
    const merged = mergeReports([shard(1).report, shard(2).report]);
    expect(Object.keys(merged.files).sort()).toEqual([...files].sort());
    expect(scoreOf(merged)).toBe(50);
  });

  it("passes when every shard is there and matches the partition", () => {
    expect(
      aggregateVerdict({ mutate, files, of, weightOf, shards: [shard(1), shard(2)] })
    ).toBeNull();
  });

  it("fails when a shard is missing", () => {
    expect(aggregateVerdict({ mutate, files, of, weightOf, shards: [shard(1)] })).toMatch(
      /shard 2 of 2 is missing/
    );
  });

  it("fails when a shard mutated other files than the partition gives it", () => {
    const files2 = [...shard(2).manifest.files, ...shard(1).manifest.files];
    const wrong = { ...shard(2), manifest: { ...shard(2).manifest, files: files2 } };
    expect(aggregateVerdict({ mutate, files, of, weightOf, shards: [shard(1), wrong] })).toMatch(
      /shard 2 of 2 mutated other files/
    );
  });

  it("fails when the shards hold no mutant at all", () => {
    const empty = [1, 2].map((i) => ({ ...shard(i), report: { files: {} } }));
    expect(aggregateVerdict({ mutate, files, of, weightOf, shards: empty })).toMatch(/no mutant/);
  });
});

describe("running one shard", () => {
  const base = JSON.parse(read("stryker.conf.json")) as Record<string, unknown>;

  it("keeps the whole config and makes only its files, sandbox and reports its own", () => {
    const config = shardConfig(base, {
      files: ["src/kernel/a.ts"],
      dir: "reports/mutation/kernel/shard-1-of-3",
      tempDirName: ".stryker-tmp-kernel-1",
    });
    const own = [
      "mutate",
      "incremental",
      "incrementalFile",
      "tempDirName",
      "htmlReporter",
      "jsonReporter",
    ];
    for (const [key, value] of Object.entries(base)) {
      if (!own.includes(key)) expect(config[key], key).toEqual(value);
    }
    expect(config).toMatchObject({
      mutate: ["src/kernel/a.ts"],
      incremental: true,
      incrementalFile: "reports/mutation/kernel/shard-1-of-3/incremental.json",
      tempDirName: ".stryker-tmp-kernel-1",
      jsonReporter: { fileName: "reports/mutation/kernel/shard-1-of-3/mutation.json" },
      htmlReporter: { fileName: "reports/mutation/kernel/shard-1-of-3/report.html" },
    });
  });

  it("takes only the cut the scope declares", () => {
    expect(parseShard("2/3", { shards: 3 })).toEqual({ shard: 2, of: 3 });
    expect(() => parseShard("2/4", { shards: 3 })).toThrow(/does not fit/);
    expect(() => parseShard("4/3", { shards: 3 })).toThrow(/does not fit/);
    expect(() => parseShard("0/3", { shards: 3 })).toThrow(/does not fit/);
    expect(() => parseShard("1/1", {})).not.toThrow();
    expect(() => parseShard("x", { shards: 3 })).toThrow(/takes i\/n/);
  });
});
