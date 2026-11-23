/**
 * CI and the git hooks live outside this package, so a script renamed here goes on being
 * called there while every local check passes. The same distance hides a job that runs a script
 * on a bare checkout: a script of this package that imports a package from `node_modules` fails
 * there unless the job installs this package's dependencies first, and every local run already
 * has them.
 *
 * Calls: Only calls that run against this package
 * count: a `cd cli && pnpm x` line, or a call in a `run:` block that `cd`s here first -
 * `cd` on one line still governs a `pnpm` call two lines later, in the same shell.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { wireTools } from "../../src/composition/contexts/tools.js";
import { buildTargetModesOf } from "../../src/contexts/translate/contract/build-targets.js";
import { present } from "../shared/testing/present.builder.js";
import { CLI_ROOT } from "./source-graph.js";
import {
  jobsOf,
  packagesReachedFrom,
  pnpmCallsAgainst,
  runBodies,
  scriptsCalledBeforeInstall,
} from "./workflow-text.js";

const REPO_ROOT = join(CLI_ROOT, "..");
const WORKFLOWS = join(REPO_ROOT, ".github", "workflows");

/** pnpm's built-in verbs, which are never package scripts. */
const PNPM_BUILTINS = new Set([
  "install",
  "exec",
  "run",
  "dlx",
  "add",
  "remove",
  "why",
  "pack",
  "publish",
  "store",
  "workspace",
  "list",
  "outdated",
  "update",
  "config",
  "link",
  "audit",
  "-r",
  "--filter",
]);

function manifestScripts(): Set<string> {
  const manifest = JSON.parse(readFileSync(join(CLI_ROOT, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  return new Set(Object.keys(manifest.scripts));
}

function automationFiles(): string[] {
  const files = [join(REPO_ROOT, "lefthook.yml")];
  for (const entry of readdirSync(WORKFLOWS)) {
    if (entry.endsWith(".yml") || entry.endsWith(".yaml")) files.push(join(WORKFLOWS, entry));
  }
  return files;
}

function undeclaredScriptCalls(text: string, declared: ReadonlySet<string>): string[] {
  const missing: string[] = [];
  for (const body of runBodies(text)) {
    for (const script of pnpmCallsAgainst("cli", body)) {
      if (!PNPM_BUILTINS.has(script) && !declared.has(script)) missing.push(script);
    }
  }
  return missing;
}

function foreignIncludes(tsconfig: string): string[] {
  const config = JSON.parse(tsconfig.replace(/\/\/[^\n]*/g, "")) as { include?: string[] };
  return (config.include ?? []).filter((pattern) => pattern.startsWith("../"));
}

describe("this package's program stops at this package", () => {
  it("compiles nothing outside cli/, so a CI job needs no sibling's dependencies", () => {
    expect(
      foreignIncludes(readFileSync(join(CLI_ROOT, "tsconfig.json"), "utf8")),
      "tsconfig reaches outside the package - every job running tsc must then install that sibling's dependencies, and dropping one breaks CI while every local check stays green"
    ).toEqual([]);
  });
});

describe("the automation calls scripts this package still has", () => {
  it("every pnpm script CI and the hooks run against cli/ exists in its manifest", () => {
    const scripts = manifestScripts();
    const missing = automationFiles()
      .flatMap((file) =>
        undeclaredScriptCalls(readFileSync(file, "utf8"), scripts).map(
          (script) => `${file.replace(`${REPO_ROOT}/`, "")}: pnpm ${script}`
        )
      )
      .sort();

    expect(missing, "an automation file runs a script cli/package.json no longer declares").toEqual(
      []
    );
  });

  it("finds a call in a workflow and ignores pnpm's own verbs", () => {
    const found = undeclaredScriptCalls(
      readFileSync(join(WORKFLOWS, "cli-ci.yml"), "utf8"),
      new Set()
    );

    expect(found, "the real workflow calls this package's scripts").toContain("knip");
    expect(found, "`pnpm install` is not a script").not.toContain("install");
  });
});

describe("the automation lists the tools the catalog registers", () => {
  it("builds each (tool, mode) pair the catalog supports in ci.yml, and no other", () => {
    const pairs = [
      ...readFileSync(join(WORKFLOWS, "ci.yml"), "utf8").matchAll(
        /-\s*\{\s*tool:\s*(\w+),\s*mode:\s*(\w+)\s*\}/g
      ),
    ].map(([, tool, mode]) => `${tool}:${mode}`);
    const supported = buildTargetModesOf(wireTools()).map(
      ({ target, mode }) => `${target}:${mode}`
    );

    expect(pairs.sort()).toEqual(supported.sort());
  });

  it("names the AI tools and the IDE tools of the catalog in smoke-tools.sh, in help order", () => {
    const script = readFileSync(join(CLI_ROOT, "scripts", "smoke-tools.sh"), "utf8");
    const listed = (name: string) =>
      new RegExp(`^${name}=\\(([^)]*)\\)`, "m").exec(script)?.[1]?.trim().split(/\s+/);
    const catalog = wireTools();

    expect(listed("AI_TOOLS")).toEqual([...catalog.inHelpOrder("ai")]);
    expect(listed("IDE_TOOLS")).toEqual([...catalog.inHelpOrder("ide")]);
  });
});

describe("the call guard itself", () => {
  it("names a script the manifest lost and stays silent on one it still declares", () => {
    const workflow = ["      - run: |", "          cd cli", "          pnpm gone", ""].join("\n");

    expect(undeclaredScriptCalls(workflow, new Set(["knip"]))).toEqual(["gone"]);
    expect(undeclaredScriptCalls(workflow, new Set(["gone"]))).toEqual([]);
  });

  it("reads an include reaching outside the package, and clears one that stays inside", () => {
    expect(foreignIncludes('{ "include": ["../kanban/src/**/*.ts"] }')).toEqual([
      "../kanban/src/**/*.ts",
    ]);
    expect(foreignIncludes('{ "include": ["src/**/*.ts"] } // a trailing note')).toEqual([]);
  });

  it("follows cd line by line inside a run: | block, past where the old regex stopped seeing", () => {
    const block = [
      "        run: |",
      "          cd cli",
      "          pnpm build",
      "          pnpm pack --pack-destination ./dist",
      "          npm install -g ./dist/ai-driven-dev-cli-*.tgz --force",
    ].join("\n");

    expect(runBodies(block)).toEqual([
      [
        "          cd cli",
        "          pnpm build",
        "          pnpm pack --pack-destination ./dist",
        "          npm install -g ./dist/ai-driven-dev-cli-*.tgz --force",
      ],
    ]);
    expect(pnpmCallsAgainst("cli", present(runBodies(block)[0]))).toContain("build");
  });

  it("does not let cd cross into a later, unrelated run: body", () => {
    const twoSteps = [
      "      - run: |",
      "          cd kanban",
      "      - run: |",
      "          pnpm bogus-script",
    ].join("\n");

    for (const body of runBodies(twoSteps)) {
      expect(pnpmCallsAgainst("cli", body)).toEqual([]);
    }
  });
});

function jobsMissingTheirInstall(): string[] {
  return readdirSync(WORKFLOWS)
    .filter((name) => /\.ya?ml$/.test(name))
    .flatMap((entry) =>
      [...jobsOf(readFileSync(join(WORKFLOWS, entry), "utf8"))].flatMap(([job, lines]) =>
        scriptsCalledBeforeInstall(lines).flatMap((script) => {
          const packages = packagesReachedFrom(join(CLI_ROOT, "scripts", script));
          return packages.length > 0 ? [`${entry} ${job}: ${script} needs ${packages[0]}`] : [];
        })
      )
    );
}

describe("CI installs what the cli scripts it runs import", () => {
  it("installs this package's dependencies before a job runs a script that reaches one", () => {
    expect(jobsMissingTheirInstall()).toEqual([]);
  });
});
