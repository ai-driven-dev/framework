/**
 * These tests read source as text and never import the code under test, so they stay fast
 * enough for a pre-commit hook and cannot be broken by runtime wiring.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, posix, relative, resolve, sep } from "node:path";
import {
  matchesGlob as scopeGlob,
  sourceFiles as srcFiles,
} from "../../scripts/mutation-shards.mjs";
import { present } from "../shared/testing/present.builder.js";

export const CLI_ROOT = resolve(import.meta.dirname, "..", "..");
export const SRC = join(CLI_ROOT, "src");

export const REPO_ROOT = resolve(CLI_ROOT, "..");

// The package's own node launcher: `.bin/biome` is a shell shim, a `.cmd` on Windows.
export const BIOME = join(CLI_ROOT, "node_modules", "@biomejs", "biome", "bin", "biome");

/** A file property as the GitHub reporter escapes it, `C:` written `C%3A` on Windows. */
export function reportedFile(raw: string): string {
  return raw.replace(/%3A/gi, ":").replace(/%2C/gi, ",").replace(/%25/g, "%");
}

/** The diagnostics biome prints for one planted tree, as `<file>:<rule>` lines. */
export function biomeFindings(projectDir: string, launcher = BIOME): string[] {
  const result = spawnSync(process.execPath, [launcher, "lint", "--reporter=github", "."], {
    cwd: projectDir,
    encoding: "utf8",
  });
  const findings = `${result.stdout}\n${result.stderr}`
    .split("\n")
    .map((line) => /^\s*::(?:error|warning) title=(\S+),file=(\S+?),/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map(
      (match) =>
        `${relative(
          realpathSync(projectDir),
          realpathSync(resolve(projectDir, reportedFile(present(match[2]))))
        )
          .split(sep)
          .join("/")}:${match[1]}`
    )
    .sort();
  // biome exits 0 when clean and 1 with diagnostics; anything else never linted.
  if (result.status !== 0 && !(result.status === 1 && findings.length > 0)) {
    throw new Error(`biome did not run: ${result.error?.message ?? result.stderr}`);
  }
  return findings;
}

export function canonicalPath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function sourceFiles(): string[] {
  return srcFiles();
}

/** Every `.ts` file under a `cli/`-relative directory, kits and support files included, as a `cli/`-relative path, sorted. */
export function tsFilesUnder(dir: string): string[] {
  return readdirSync(join(CLI_ROOT, dir), { recursive: true, encoding: "utf8" })
    .map((entry) => canonicalPath(join(dir, entry)))
    .filter((path) => path.endsWith(".ts"))
    .sort();
}

export function read(relativePath: string): string {
  return readFileSync(join(CLI_ROOT, relativePath), "utf8");
}

export function readFromRepoRoot(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

export function pluginReadmes(): string[] {
  const pluginsDir = join(REPO_ROOT, "plugins");
  const found: string[] = [];
  for (const entry of readdirSync(pluginsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const readme = join(pluginsDir, entry.name, "README.md");
    if (existsSync(readme)) found.push(canonicalPath(join("plugins", entry.name, "README.md")));
  }
  if (found.length === 0) {
    throw new Error("no plugin README found - the scope of this rule is stale");
  }
  return found.sort();
}

/**
 * Every way one file names another: `from "./x.js"`, a bare side-effect `import "./x.js"`,
 * and the `import("./x.js")` type expression. A second extractor anywhere in this directory
 * would disagree with this one and hide a real dependency. The `@/` alias resolves to `src/`
 * and is handled although nothing uses it today, so using it takes no file out of sight.
 */
export const INTERNAL_IMPORT = /(?:from|import)\s*\(?\s*["'](\.[^"']+|@\/[^"']+)["']/g;

export function resolveImportTarget(file: string, specifier: string): string {
  const target = canonicalPath(specifier);
  return (
    target.startsWith("@/")
      ? `src/${target.slice(2)}`
      : posix.join(posix.dirname(canonicalPath(file)), target)
  ).replace(/\.js$/, ".ts");
}

/** Side-effect imports (`import "./x.js"`) count: a module that runs on import is a dependency. */
export function importersByFile(): Map<string, Set<string>> {
  const files = sourceFiles();
  const known = new Set(files);
  const importers = new Map<string, Set<string>>();
  for (const file of files) {
    const text = read(file);
    for (const match of text.matchAll(INTERNAL_IMPORT)) {
      const target = resolveImportTarget(file, present(match[1]));
      if (!known.has(target)) continue;
      const set = importers.get(target) ?? new Set<string>();
      set.add(file);
      importers.set(target, set);
    }
  }
  return importers;
}

/**
 * The subset of glob syntax this suite declares: a literal prefix, `/**\/` for any number of
 * directories *including none* - `src/shared/domain/**\/*.ts` must match `src/shared/domain/tool.ts` too,
 * or a scope silently covers only its subdirectories - and `*` within one segment.
 */
export function matchesGlob(glob: string, path: string): boolean {
  return scopeGlob(glob, path);
}

// The context graph. The edge table is `allowed-edges.ts`; `biome-boundaries.arch.test.ts` holds
// biome's per-context `noRestrictedImports` overrides to it.

export function contextNames(): string[] {
  return readdirSync(join(SRC, "contexts"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function contextOf(file: string): string {
  const inContext = /^src\/contexts\/([^/]+)\//.exec(file);
  if (inContext) return present(inContext[1]);
  if (file.startsWith("src/shared/")) return "shared";
  if (file.startsWith("src/presentation/")) return "presentation";
  if (file.startsWith("src/composition/")) return "composition";
  if (file.startsWith("src/orchestration/")) return "orchestration";
  return "outside";
}

/** A layer a context may not depend on: the arrows run towards shared, never back. The
 * composition wires every context and is imported by the composition root alone; the
 * orchestration chains contexts and is reached from presentation and the composition. */
export const BELOW_NOTHING = new Set(["presentation", "composition", "orchestration"]);

export function isContext(name: string): boolean {
  return !BELOW_NOTHING.has(name) && !["shared", "outside"].includes(name);
}

/**
 * Every invocation the CLI declares: a top-level verb, and each `noun verb` pair. The pair
 * matters - `aidd plugin marketplace add` passes any check reading only the first word.
 */
export function declaredCommands(): Set<string> {
  const declared = new Set<string>();
  for (const file of sourceFiles().filter((f) => f.startsWith("src/presentation/controllers/"))) {
    const source = read(file);
    // `program.command("noun")` names a parent; every other `.command("verb")` in that file
    // is one of its subcommands.
    const parent = /program\s*\n?\s*\.?command\("([a-z][a-z-]*)"/.exec(source)?.[1];
    for (const match of source.matchAll(/\.command\("([a-z][a-z-]*)/g)) {
      declared.add(present(match[1]));
      if (parent !== undefined && match[1] !== parent) declared.add(`${parent} ${match[1]}`);
    }
  }
  // An empty set would clear every document at once: nothing can be undeclared when nothing
  // is declared.
  if (declared.size === 0) throw new Error("no command found - the scope of this rule is stale");
  return declared;
}

/** A placeholder, or a word a path continues right past: `aidd sync rules/naming.md` names a
 * file, and the `/` right after it is the tell no placeholder syntax gives. */
function isArgumentLike(word: string, trailing: string): boolean {
  return word.startsWith("<") || word.startsWith("[") || trailing.startsWith("/");
}

const INSTRUCTED_COMMAND = /\baidd ([a-z][a-z-]*)(?: ([a-z][a-z-]*)([^\s`]*))?/g;

/** The command a mention names that the declared set does not have, when it names one.
 * A bare verb needs only itself declared - `aidd setup --ai` reads as one, a flag being no word
 * this pattern captures. A pair needs the pair, unless its first word is a declared verb followed
 * by an argument: `aidd marketplace add` is a pair, `aidd update --force` is not. */
function undeclaredMention(
  declared: ReadonlySet<string>,
  first: string,
  second: string | undefined,
  trailing: string | undefined
): string | undefined {
  if (second === undefined) return declared.has(present(first)) ? undefined : present(first);
  if (declared.has(`${first} ${second}`)) return undefined;
  const verbWithArgument = declared.has(present(first)) && isArgumentLike(second, trailing ?? "");
  return verbWithArgument ? undefined : `${first} ${second}`;
}

/** `aidd <verb>` or `aidd <noun> <verb>` as it appears inside text, resolved against a
 * pair-aware declared set. */
export function unresolvedCommandMentions(text: string, declared: ReadonlySet<string>): string[] {
  return [...text.matchAll(INSTRUCTED_COMMAND)].flatMap((match) => {
    const [, first, second, trailing] = match;
    return undeclaredMention(declared, first, second, trailing) ?? [];
  });
}
