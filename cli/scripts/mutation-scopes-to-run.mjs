#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The mutation setup: what reshapes how every scope is scored, relative to the repository root.
 * The stryker and vitest mutation configs, the scope declaration, the runner, the shard
 * partition and the helpers the mutation config loads. A change here runs every scope.
 */
export const HARNESS = [
  "cli/mutation-scopes.json",
  "cli/stryker.conf.json",
  "cli/vitest.mutation.config.ts",
  "cli/scripts/run-mutation.mjs",
  "cli/scripts/mutation-shards.mjs",
  "cli/tests/helpers/mutation-sequencer.ts",
  "cli/tests/helpers/unloadable-file-as-failed-test.ts",
  "cli/tests/helpers/vitest-text-loader.ts",
  "cli/tests/helpers/throwaway-profile.ts",
];

/**
 * Dependency files. Each leg is incremental, so a dependency change replays almost no mutant;
 * drift through a dependency is replayed by the weekly `--force` run on `main`, after promotion.
 * The `canary` scope exists to catch a Stryker or Vitest upgrade, and nothing else checks that
 * before promotion, so a dependency change runs `canary` (about half a job-minute) and no other
 * scope of its own.
 */
const DEPENDENCIES = ["cli/package.json", "cli/pnpm-lock.yaml"];
const DEPENDENCY_SCOPE = "canary";

/** A scope runs when its source or its mirrored tests changed, or when the mutation setup did.
 * A dependency, workflow, selector or other test-helper change runs only what its own files
 * touch, plus `canary` for a dependency. With no usable diff, every scope runs. */
export function scopesToRun(changed, scopes, { all = false } = {}) {
  const everything = all || changed.some((file) => HARNESS.includes(file));
  const dependencies = changed.some((file) => DEPENDENCIES.includes(file));
  return Object.entries(scopes)
    .filter(
      ([name, { mutate }]) =>
        (dependencies && name === DEPENDENCY_SCOPE) ||
        [mutate].flat().some((glob) => {
          if (glob.startsWith("!")) return false;
          const source = `cli/${glob.slice(0, glob.indexOf("/**"))}/`;
          const tests = source.replace("cli/src/", "cli/tests/");
          return (
            everything || changed.some((file) => file.startsWith(source) || file.startsWith(tests))
          );
        })
    )
    .map(([name]) => name);
}

/** The CI legs for `names`: one per shard of a sharded scope, one for any other. */
export function legsOf(names, scopes) {
  return names.flatMap((scope) => {
    const of = scopes[scope].shards ?? 1;
    return Array.from({ length: of }, (_, i) => ({ scope, shard: i + 1, of }));
  });
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const scopes = JSON.parse(readFileSync(join(CLI_ROOT, "mutation-scopes.json"), "utf8")).scopes;
  const changed = (process.env.CHANGED ?? "").split("\n").filter(Boolean);
  const names = scopesToRun(changed, scopes, { all: process.env.ALL === "true" });
  // `legs` feeds the mutation matrix; `sharded` the jobs that score a split scope once.
  const output =
    process.env.OUTPUT === "sharded"
      ? names.filter((name) => (scopes[name].shards ?? 1) > 1)
      : legsOf(names, scopes);
  process.stdout.write(JSON.stringify(output));
}
