#!/usr/bin/env node
// Enforces the one invariant of cli/.claude/rules/01-standards/1-type-honesty.md that a
// linter cannot express: no value is widened away from the type it claims to hold.
// Dependency direction belongs to biome, whose per-layer `noRestrictedImports` overrides
// match the resolved path — a hand-picked prefix here goes stale the moment a layer moves.

import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CLI = path.join(process.cwd(), "cli");
const SRC = path.join(CLI, "src");
const TESTS = path.join(CLI, "tests");
const ASSERTIONS_BASELINE = path.join(CLI, "type-assertions-baseline.json");

/**
 * `\bas` keeps prose out - "was never" has no word boundary before its "as". `any` needs the
 * negative lookahead on top: it is also an English word, and a real cast's `any` is a
 * complete type, so what follows it is punctuation, never another word.
 */
const WIDENING_ANYWHERE = [
  /\bas\s+unknown\s+as\b/,
  /\bas\s+never\b/,
  /\bas\s+any\b(?!\s*[a-zA-Z])/,
];

/**
 * Checked in `src/` only: a test whose whole point is that a shape does not compile has no
 * other way to assert it, and that is a compiler assertion rather than a widened value.
 * Production code has no "prove this doesn't compile" to make.
 */
const WIDENING_SRC_ONLY = [/@ts-expect-error\b/, /@ts-ignore\b/];

/**
 * Every spelling that turns text into a tool id: an `as` followed by any type that names a tool
 * id (`as AiToolId`, `as readonly ToolId[]`, `as Set<ToolId>`, `as Record<ToolId, x>`), `as typeof
 * TOOL.x`, and an angle-bracket cast. `\s` lets a line break follow `as`. Checked in `src/` and
 * `tests/` alike, outside `TOOL_ID_MINTER`.
 */
const TOOL_ID_CAST = new RegExp(
  [
    String.raw`\bas\s+[^;=\n]{0,80}?\b(?:Ai|Ide)?ToolId\b`,
    String.raw`\bas\s+typeof\s+TOOL\b`,
    String.raw`(?<![\w$>])<\s*(?:Ai|Ide)?ToolId\s*>\s*[\w$"'\`(\[{]`,
  ].join("|")
);

/**
 * A type predicate or assertion to a tool id (`x is ToolId`, `asserts x is IdeToolId`), whatever
 * the parameter type or position: a hand-written one turns any text into an id the catalog never
 * saw. Only the catalog's own declarations and `TOOL_ID_MINTER` may write one.
 */
const TOOL_ID_PREDICATE = /\bis\s+(?:Ai|Ide)?ToolId\b/;

/** An import or export specifier list renames with `as` (`import { a as b, type ToolId }`): it
 * casts nothing, so the tool-id rules read the source without it. */
const SPECIFIER_LIST =
  /^(?:import|export)\b[^;]*?\bfrom\s*["'][^"']*["']|^export\s*(?:type\s*)?\{[^}]*\}/gm;

/** The one file where a written name becomes a tool id: a profile's own definition. */
const TOOL_ID_MINTER = "src/contexts/tools/domain/profile/define-tool.ts";

/** The files that declare the catalog's narrowing predicates `isAiTool` and `isIdeTool`. */
const TOOL_ID_PREDICATE_HOLDERS = new Set([
  TOOL_ID_MINTER,
  "src/contexts/tools/contract/tool-catalog.ts",
  "src/contexts/tools/application/registered-tool-catalog.ts",
]);

/** Cli-relative paths, each with the reason the cast survives. Listed so adding one is a
 * decision rather than a default. */
const CASTS_ALLOWED = new Map([
  [
    "src/contexts/translate/application/build-native-tree.ts",
    "SourceMarketplace carries an index signature beside typed optional members, so no " +
      "parsed `Record<string, unknown>` can ever satisfy it; narrowing it honestly would " +
      "mean rejecting catalogs the builder accepts today",
  ],
]);

/**
 * Type assertions (`x as T`, `<T>x`) are counted per file against a baseline that only shrinks:
 * `satisfies` checks instead of asserting, and `as const` asserts nothing wider than the value.
 * The parser is the TypeScript compiler's own, reached through the cli's installed package.
 */
const cliRequire = createRequire(new URL("../cli/package.json", import.meta.url));
const importFromCli = (specifier) => import(pathToFileURL(cliRequire.resolve(specifier)).href);

async function countTypeAssertions() {
  const { API } = await importFromCli("typescript/unstable/sync");
  const { isAsExpression, isTypeAssertion, isTypeReferenceNode, isIdentifier } =
    await importFromCli("typescript/unstable/ast/is");
  const isConst = (type) =>
    isTypeReferenceNode(type) && isIdentifier(type.typeName) && type.typeName.text === "const";
  const api = new API({ cwd: CLI });
  try {
    const project = api
      .updateSnapshot({ openProject: path.join(CLI, "tsconfig.json") })
      .getProjects()[0];
    const found = new Map();
    for (const name of project.program.getSourceFileNames()) {
      const cliPath = relative(CLI, name);
      if (!/^(?:src|tests)\/.+\.ts$/.test(cliPath)) continue;
      const sourceFile = project.program.getSourceFile(name);
      const lines = [];
      const visit = (node) => {
        if ((isAsExpression(node) || isTypeAssertion(node)) && !isConst(node.type)) {
          lines.push(sourceFile.text.slice(0, node.type.pos).split("\n").length);
        }
        node.forEachChild(visit);
      };
      sourceFile.forEachChild(visit);
      if (lines.length > 0) found.set(cliPath, lines);
    }
    return found;
  } finally {
    api.close();
  }
}

async function readAssertionsBaseline() {
  try {
    return JSON.parse(await readFile(ASSERTIONS_BASELINE, "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

/**
 * The baseline at the merge-base with `ARCH_BASE_REF`, else with `origin/` and the branch a pull
 * request targets, else with `origin/next`, as `baseline-only-shrinks` resolves it. A change that
 * adds the file meets a base without it and is not compared. A base git cannot give fails: a
 * ratchet that skips is not one.
 */
function readBaseBaseline(breaches) {
  const ref = process.env.ARCH_BASE_REF || `origin/${process.env.GITHUB_BASE_REF || "next"}`;
  const git = (...args) => execFileSync("git", args, { encoding: "utf-8", stdio: "pipe" }).trim();
  let base;
  try {
    base = git("merge-base", "HEAD", ref);
  } catch {
    breaches.push(
      `  no merge-base with ${ref}: run \`git fetch origin\` or name another ref in ARCH_BASE_REF`
    );
    return null;
  }
  try {
    return JSON.parse(git("show", `${base}:cli/type-assertions-baseline.json`));
  } catch {
    return null;
  }
}

function baselineRises(baseline, base) {
  return Object.keys(baseline)
    .sort()
    .filter((cliPath) => baseline[cliPath] > (base[cliPath] ?? 0))
    .map(
      (cliPath) =>
        `  cli/${cliPath} holds ${baseline[cliPath]} at the head and ${base[cliPath] ?? 0} at the base: a baseline only goes down`
    );
}

function assertionBreaches(found, baseline) {
  const breaches = [];
  for (const cliPath of [...new Set([...found.keys(), ...Object.keys(baseline)])].sort()) {
    const lines = found.get(cliPath) ?? [];
    const allowed = baseline[cliPath] ?? 0;
    if (lines.length > allowed) {
      breaches.push(
        `  cli/${cliPath} has ${lines.length} type assertions, baseline ${allowed}: ` +
          `${lines.map((line) => `cli/${cliPath}:${line}`).join(", ")} - parse, narrow or build the value instead`
      );
    } else if (lines.length < allowed) {
      breaches.push(
        `  cli/${cliPath} has ${lines.length} type assertions, baseline ${allowed}: ` +
          "lower it in cli/type-assertions-baseline.json"
      );
    }
  }
  return breaches;
}

async function typescriptFilesUnder(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await typescriptFilesUnder(full)));
    else if (entry.name.endsWith(".ts")) found.push(full);
  }
  return found;
}

/** Keys are written with `/` so the allow-list reads the same on every platform. */
function relative(from, file) {
  return path.relative(from, file).split(path.sep).join("/");
}

function widensAType(source, patterns) {
  return patterns.some((pattern) => pattern.test(source));
}

function castBreach(cliPath, source, patterns) {
  if (!widensAType(source, patterns) || CASTS_ALLOWED.has(cliPath)) return null;
  return (
    `cli/${cliPath} widens a type through \`as unknown as\`, \`as any\`, \`as never\`, ` +
    "`@ts-expect-error` or `@ts-ignore` - build the value with the type it claims"
  );
}

const breaches = [];
const spentAllowances = new Set();

for (const root of [SRC, TESTS]) {
  const patterns = root === SRC ? [...WIDENING_ANYWHERE, ...WIDENING_SRC_ONLY] : WIDENING_ANYWHERE;
  for (const file of await typescriptFilesUnder(root)) {
    const cliPath = relative(CLI, file);
    const source = await readFile(file, "utf-8");
    if (widensAType(source, patterns)) spentAllowances.add(cliPath);
    const breach = castBreach(cliPath, source, patterns);
    if (breach) breaches.push(`  ${breach}`);
    const written = source.replace(SPECIFIER_LIST, "");
    if (cliPath !== TOOL_ID_MINTER && TOOL_ID_CAST.test(written)) {
      breaches.push(`  cli/${cliPath} casts text to a tool id - ask the catalog, or take a string`);
    }
    if (!TOOL_ID_PREDICATE_HOLDERS.has(cliPath) && TOOL_ID_PREDICATE.test(written)) {
      breaches.push(
        `  cli/${cliPath} declares a predicate to a tool id - ask the catalog, or take a string`
      );
    }
  }
}

// An allowance nobody spends is stale: the cast it excused is gone, so the line goes too.
for (const cliPath of CASTS_ALLOWED.keys()) {
  if (!spentAllowances.has(cliPath)) {
    breaches.push(`  cli/${cliPath} no longer casts - drop its CASTS_ALLOWED entry`);
  }
}

const assertionsBaseline = await readAssertionsBaseline();
const baseBaseline = readBaseBaseline(breaches);
if (baseBaseline !== null) breaches.push(...baselineRises(assertionsBaseline, baseBaseline));
breaches.push(...assertionBreaches(await countTypeAssertions(), assertionsBaseline));

if (breaches.length > 0) {
  console.error(`cli type-honesty breaches:\n${breaches.join("\n")}`);
  console.error("Contract: cli/.claude/rules/01-standards/1-type-honesty.md");
  process.exit(1);
}

console.log(
  "No type is widened through unknown, any or never, no directive silences the compiler outside a test proving something does not compile, and no file holds more type assertions than its baseline."
);
