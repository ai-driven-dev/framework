#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Every `.ts` file under `src/`, relative to `cli/` with `/`, sorted: what a scope is cut from. */
export function sourceFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".ts")) out.push(relative(CLI_ROOT, full).replaceAll("\\", "/"));
    }
  };
  walk(join(CLI_ROOT, "src"));
  return out.sort();
}

/** A file's weight in a shard: its line count, which the number of its mutants follows. */
export function linesOf(path) {
  return readFileSync(join(CLI_ROOT, path), "utf8").split("\n").length;
}

/** A `mutate` glob as `mutation-scopes.json` writes them: `**` crosses directories, `*` does not. */
export function matchesGlob(glob, path) {
  const pattern = glob
    .split("/**/")
    .map((segment) => segment.split("*").map(escapeGlobLiteral).join("[^/]*"))
    .join("/(?:.*/)?");
  return new RegExp(`^${pattern}$`).test(path);
}

function escapeGlobLiteral(literal) {
  return literal.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

/** Whether a scope's `mutate` takes `path`: one of its globs matches and no `!` glob does. */
export function inScope(mutate, path) {
  const globs = [mutate].flat();
  return (
    globs.some((glob) => !glob.startsWith("!") && matchesGlob(glob, path)) &&
    !globs.some((glob) => glob.startsWith("!") && matchesGlob(glob.slice(1), path))
  );
}

/** The scope's files among `files`, sorted. */
export function scopeFiles(mutate, files) {
  return files.filter((path) => inScope(mutate, path)).sort();
}

/** The scope's files cut into `of` shards of about the same weight: heaviest file first, each
 * to the lightest shard so far, ties broken by path and by shard number. The same files at the
 * same weights give the same shards on every machine. */
export function partition(mutate, files, of, weightOf = linesOf) {
  const weighted = scopeFiles(mutate, files)
    .map((path) => ({ path, weight: weightOf(path) }))
    .sort((a, b) => b.weight - a.weight || (a.path < b.path ? -1 : 1));
  const shards = Array.from({ length: of }, () => ({ weight: 0, files: [] }));
  for (const { path, weight } of weighted) {
    const lightest = shards.reduce((min, shard) => (shard.weight < min.weight ? shard : min));
    lightest.files.push(path);
    lightest.weight += weight;
  }
  return shards.map((shard) => shard.files.sort());
}

/** The files shard `shard` (from 1) of `of` mutates. */
export function shardFiles(mutate, files, shard, of, weightOf = linesOf) {
  return partition(mutate, files, of, weightOf)[shard - 1];
}

/** The shards' reports as one: each file is in exactly one shard, so nothing overlaps. */
export function mergeReports(reports) {
  return { files: Object.assign({}, ...reports.map((report) => report.files ?? {})) };
}

/** Why a sharded scope cannot be scored, or null. Every shard must be there, each must have
 * mutated exactly what the partition gives it at this commit, and something must have been
 * mutated: a missing or drifted shard would lift the score by leaving mutants out. */
export function aggregateVerdict({ mutate, files, of, shards, weightOf = linesOf }) {
  for (let shard = 1; shard <= of; shard += 1) {
    const found = shards.find((candidate) => candidate.manifest.shard === shard);
    if (found === undefined) return `shard ${shard} of ${of} is missing`;
    if (found.manifest.of !== of)
      return `shard ${shard} was cut in ${found.manifest.of}, not ${of}`;
    const expected = shardFiles(mutate, files, shard, of, weightOf);
    const mutated = [...found.manifest.files].sort();
    if (JSON.stringify(mutated) !== JSON.stringify(expected)) {
      return `shard ${shard} of ${of} mutated other files than the partition gives it`;
    }
  }
  const mutants = Object.values(mergeReports(shards.map((s) => s.report)).files).flatMap(
    (file) => file.mutants
  ).length;
  return mutants === 0 ? "the shards hold no mutant" : null;
}
