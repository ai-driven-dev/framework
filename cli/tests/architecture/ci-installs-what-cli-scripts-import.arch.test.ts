/**
 * A CI job runs on a bare checkout: a script of this package that imports a package from
 * `node_modules` fails there unless the job installs this package's dependencies first. Every
 * local run already has them installed, so only this guard sees a job that forgot.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT } from "./helpers.js";
import { present } from "./present.js";

const WORKFLOWS = join(CLI_ROOT, "..", ".github", "workflows");
const INSTALL = /cd cli && pnpm install\b/;
/** `node cli/scripts/x.mjs` from the root, or `node scripts/x.mjs` after `cd cli &&`. */
const SCRIPT_CALL = /(?:node cli\/scripts\/|cd cli && node scripts\/)([\w.-]+\.m?js)\b/;

/** The packages a script reaches, through its own relative imports too. */
function packagesReachedFrom(file: string, seen = new Set<string>()): string[] {
  if (seen.has(file) || !existsSync(file)) return [];
  seen.add(file);
  const found: string[] = [];
  const source = readFileSync(file, "utf8");
  const imports =
    /^\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']/gm;
  for (const [, from, bare] of source.matchAll(imports)) {
    const specifier = from ?? bare;
    if (specifier === undefined || specifier.startsWith("node:")) continue;
    if (specifier.startsWith(".")) {
      found.push(...packagesReachedFrom(resolve(dirname(file), specifier), seen));
    } else found.push(specifier);
  }
  return found;
}

/** Each job of a workflow, by name, as its lines: a job opens at two spaces under `jobs:`. */
function jobsOf(text: string): Map<string, string[]> {
  const jobs = new Map<string, string[]>();
  let inJobs = false;
  let current: string[] | undefined;
  for (const line of text.split("\n")) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    if (/^\S/.test(line)) break;
    const opens = /^ {2}([\w-]+):\s*$/.exec(line);
    if (opens) {
      current = [];
      jobs.set(present(opens[1]), current);
    } else current?.push(line);
  }
  return jobs;
}

function jobsMissingTheirInstall(): string[] {
  const missing: string[] = [];
  for (const entry of readdirSync(WORKFLOWS).filter((name) => /\.ya?ml$/.test(name))) {
    for (const [job, lines] of jobsOf(readFileSync(join(WORKFLOWS, entry), "utf8"))) {
      let installed = false;
      for (const line of lines) {
        if (INSTALL.test(line)) installed = true;
        const script = SCRIPT_CALL.exec(line)?.[1];
        if (script === undefined || installed) continue;
        const packages = packagesReachedFrom(join(CLI_ROOT, "scripts", script));
        if (packages.length > 0) missing.push(`${entry} ${job}: ${script} needs ${packages[0]}`);
      }
    }
  }
  return missing;
}

describe("CI installs what the cli scripts it runs import", () => {
  it("installs this package's dependencies before a job runs a script that reaches one", () => {
    expect(jobsMissingTheirInstall()).toEqual([]);
  });
});
