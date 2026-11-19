#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Files that reshape every scope's run at once, relative to the repository root. A change to
 * a dependency, the workflow or a test helper is not one: it moves only the scopes whose
 * source it modifies. */
export const HARNESS = [
  "cli/mutation-scopes.json",
  "cli/stryker.conf.json",
  "cli/vitest.mutation.config.ts",
];

/** A lockfile change can move Stryker or Vitest, so it runs the `harnessOnly` canary alone. */
const LOCKFILE = "cli/pnpm-lock.yaml";

/** Only a scope that declares a floor can fail a run, so only it is run per change. */
const blocks = (scope) => scope.break !== undefined;

/** Whether `file` lies under `glob`: a prefix ending in `/**`, otherwise one file. Globs are
 * relative to `cli/`, changed files to the repository root. */
function covers(glob, file) {
  const wild = glob.indexOf("/**");
  return wild === -1 ? file === `cli/${glob}` : file.startsWith(`cli/${glob.slice(0, wild)}/`);
}

/** Per change, the gated scopes whose source or tests changed: a deleted or weakened test
 * lowers the kill rate, and only mutation sees it. Every scope runs for a harness file or with
 * no usable diff (the schedule, a manual run); a scope with no floor never fails, and a
 * `harnessOnly` scope (the canary) is never selected by its own files, only by a lockfile change. */
export function scopesToRun(changed, scopes, { all = false } = {}) {
  const everything = all || changed.some((file) => HARNESS.includes(file));
  return Object.entries(scopes)
    .filter(([, scope]) => {
      if (everything) return [scope.mutate].flat().some((glob) => !glob.startsWith("!"));
      if (scope.harnessOnly) return changed.includes(LOCKFILE);
      if (!blocks(scope)) return false;
      const globs = [
        ...[scope.mutate].flat().filter((glob) => !glob.startsWith("!")),
        ...(scope.tests ?? []),
      ];
      return globs.some((glob) => changed.some((file) => covers(glob, file)));
    })
    .map(([name]) => name);
}

/** The CI legs for `names`: one per shard of a sharded scope, one for any other. */
export function legsOf(names, scopes) {
  return names.flatMap((scope) => {
    const of = scopes[scope].shards ?? 1;
    const blocking = blocks(scopes[scope]);
    return Array.from({ length: of }, (_, i) => ({ scope, shard: i + 1, of, blocking }));
  });
}

/** The sharded scopes among `names`, each scored once over its legs. */
export function shardedOf(names, scopes) {
  return names
    .filter((scope) => (scopes[scope].shards ?? 1) > 1)
    .map((scope) => ({ scope, blocking: blocks(scopes[scope]) }));
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const scopes = JSON.parse(readFileSync(join(CLI_ROOT, "mutation-scopes.json"), "utf8")).scopes;
  const changed = (process.env.CHANGED ?? "").split("\n").filter(Boolean);
  const names = scopesToRun(changed, scopes, { all: process.env.ALL === "true" });
  // `legs` feeds the mutation matrix; `sharded` the jobs that score a split scope once.
  const output =
    process.env.OUTPUT === "sharded" ? shardedOf(names, scopes) : legsOf(names, scopes);
  process.stdout.write(JSON.stringify(output));
}
