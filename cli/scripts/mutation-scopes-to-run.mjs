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

/** The `cli/` directory a `mutate` glob names, and the directory of tests mirroring it. */
function directoriesOf(glob) {
  const source = `cli/${glob.replace(/^!/, "").slice(0, glob.replace(/^!/, "").indexOf("/**"))}/`;
  return [source, source.replace("cli/src/", "cli/tests/")];
}

/** A scope runs when its source, its mirrored tests, a shared test helper or the harness
 * changed; with no usable diff, every scope runs. A `!` glob that drops a whole subtree
 * (`<dir>/**\/*.ts`) also drops that subtree's changes; one that drops a file pattern, as the
 * canary's tests, does not, because those tests are what kill its mutants. */
export function scopesToRun(changed, scopes, { all = false } = {}) {
  const everything =
    all || changed.some((file) => HARNESS.includes(file) || file.startsWith("cli/tests/helpers/"));
  const under = (directories, file) => directories.some((dir) => file.startsWith(dir));
  return Object.entries(scopes)
    .filter(([, { mutate }]) => {
      const globs = [mutate].flat();
      const included = globs.filter((glob) => !glob.startsWith("!")).flatMap(directoriesOf);
      const left = globs
        .filter((glob) => glob.startsWith("!") && glob.endsWith("/**/*.ts"))
        .flatMap(directoriesOf);
      return everything || changed.some((file) => under(included, file) && !under(left, file));
    })
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
