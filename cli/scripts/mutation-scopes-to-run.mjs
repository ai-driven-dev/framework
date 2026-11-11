#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** What reshapes how every scope is scored, relative to the repository root: the mutation
 * configs, scope declaration, runner, shard partition and loaded helpers. A change runs every scope. */
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

/** These run `canary` alone: it smoke-tests a Stryker or Vitest upgrade (caught nowhere else before
 * promotion) and, for the workflow, the mutation job itself. */
const CANARY_TRIGGERS = [
  "cli/package.json",
  "cli/pnpm-lock.yaml",
  "cli/pnpm-workspace.yaml",
  ".github/workflows/cli-ci.yml",
];
const CANARY_SCOPE = "canary";

/** A scope runs when its source, mirrored tests or the mutation setup changed; a dependency or
 * workflow change adds `canary`. With no usable diff, every scope runs. */
export function scopesToRun(changed, scopes, { all = false } = {}) {
  const everything = all || changed.some((file) => HARNESS.includes(file));
  const canary = changed.some(
    (file) => CANARY_TRIGGERS.includes(file) || file.startsWith("cli/patches/")
  );
  return Object.entries(scopes)
    .filter(
      ([name, { mutate }]) =>
        (canary && name === CANARY_SCOPE) ||
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
