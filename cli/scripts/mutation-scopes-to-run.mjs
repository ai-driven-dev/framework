#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Files that reshape every scope's run at once, relative to the repository root. */
export const HARNESS = [
  "cli/mutation-scopes.json",
  "cli/stryker.conf.json",
  "cli/vitest.mutation.config.ts",
  "cli/scripts/run-mutation.mjs",
  "cli/scripts/mutation-scopes-to-run.mjs",
  "cli/scripts/mutation-shards.mjs",
  "cli/package.json",
  "cli/pnpm-lock.yaml",
  ".github/workflows/cli-ci.yml",
];

/** A scope runs when its source, its mirrored tests, a shared test helper or the harness
 * changed; with no usable diff, every scope runs. */
export function scopesToRun(changed, scopes, { all = false } = {}) {
  const everything =
    all || changed.some((file) => HARNESS.includes(file) || file.startsWith("cli/tests/helpers/"));
  return Object.entries(scopes)
    .filter(([, { mutate }]) =>
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
