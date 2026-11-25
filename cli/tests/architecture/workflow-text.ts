/**
 * The readings of CI and hook YAML that `automation-calls-real-scripts.arch.test.ts` holds the
 * repository to: the `run:` bodies of a file, the `pnpm` calls a body makes against a directory,
 * the jobs of a workflow, and the packages a script of this package reaches.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { present } from "../shared/testing/present.builder.js";

/** Leading spaces only: YAML forbids a tab for indentation. */
function indentOf(line: string): number {
  return /^(\s*)/.exec(line)?.[1]?.length ?? 0;
}

const RUN_KEY = /^(\s*)(?:-\s+)?run:\s*(.*)$/;

const endsBlock = (line: string, keyIndent: number): boolean =>
  line.trim() !== "" && indentOf(line) <= keyIndent;

/** The first line, from `from`, that is back at or above the indentation of the `run:` key. */
function blockEnd(lines: readonly string[], from: number, keyIndent: number): number {
  let end = from;
  while (end < lines.length && !endsBlock(present(lines[end]), keyIndent)) end++;
  return end;
}

/**
 * A `run: value` is a body of one line; `run: |` opens a block scalar whose body is every
 * line indented further than the `run:` key, ending at the first line back at or above that
 * indentation rather than at the next blank line.
 */
export function runBodies(text: string): string[][] {
  const lines = text.split("\n");
  const bodies: string[][] = [];
  let i = 0;
  while (i < lines.length) {
    const line = present(lines[i]);
    const match = RUN_KEY.exec(line);
    i++;
    if (!match) continue;
    const rest = present(match[2]).trim();
    if (!/^[|>][+-]?$/.test(rest)) {
      bodies.push([rest]);
      continue;
    }
    const end = blockEnd(lines, i, indentOf(line));
    bodies.push(lines.slice(i, end));
    i = end;
  }
  return bodies;
}

const CHANGE_DIRECTORY = /^cd\s+(\S+)/;
const PNPM_CALL = /^pnpm\s+([a-z][\w:.-]*)/;

/**
 * Tracked line by line the way the shell runs the block: a `cd` governs every later `pnpm`
 * call in the same body, and the state does not survive into the next `run:`, which is its
 * own shell process.
 */
export function pnpmCallsAgainst(dir: string, body: readonly string[]): string[] {
  let cwd: string | undefined;
  const calls: string[] = [];
  for (const segment of body.flatMap((line) => line.split("&&").map((part) => part.trim()))) {
    cwd = CHANGE_DIRECTORY.exec(segment)?.[1] ?? cwd;
    const script = cwd === dir ? PNPM_CALL.exec(segment)?.[1] : undefined;
    if (script) calls.push(script);
  }
  return calls;
}

const IMPORTS =
  /^\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']/gm;

const packageSpecifiers = (source: string): string[] =>
  [...source.matchAll(IMPORTS)]
    .map(([, from, bare]) => from ?? bare)
    .filter((specifier): specifier is string => !!specifier && !specifier.startsWith("node:"));

/** The packages a script reaches, through its own relative imports too. */
export function packagesReachedFrom(file: string, seen = new Set<string>()): string[] {
  if (seen.has(file) || !existsSync(file)) return [];
  seen.add(file);
  return packageSpecifiers(readFileSync(file, "utf8")).flatMap((specifier) =>
    specifier.startsWith(".")
      ? packagesReachedFrom(resolve(dirname(file), specifier), seen)
      : [specifier]
  );
}

/** Each job of a workflow, by name, as its lines: a job opens at two spaces under `jobs:`. */
export function jobsOf(text: string): Map<string, string[]> {
  const jobs = new Map<string, string[]>();
  const lines = text.split("\n");
  const start = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  if (start < 0) return jobs;
  const after = lines.slice(start + 1);
  const end = after.findIndex((line) => /^\S/.test(line));
  let current: string[] | undefined;
  for (const line of end < 0 ? after : after.slice(0, end)) {
    const opens = /^ {2}([\w-]+):\s*$/.exec(line);
    if (opens) {
      current = [];
      jobs.set(present(opens[1]), current);
    } else current?.push(line);
  }
  return jobs;
}

const INSTALL = /cd cli && pnpm install\b/;
/** `node cli/scripts/x.mjs` from the root, or `node scripts/x.mjs` after `cd cli &&`. */
const SCRIPT_CALL = /(?:node cli\/scripts\/|cd cli && node scripts\/)([\w.-]+\.m?js)\b/;

/** The scripts of this package a job calls on its lines before it installs the dependencies. The
 * line that installs is already past the point where a script needs them. */
export function scriptsCalledBeforeInstall(lines: readonly string[]): string[] {
  const installAt = lines.findIndex((line) => INSTALL.test(line));
  const before = installAt < 0 ? lines : lines.slice(0, installAt);
  return before.flatMap((line) => SCRIPT_CALL.exec(line)?.[1] ?? []);
}
