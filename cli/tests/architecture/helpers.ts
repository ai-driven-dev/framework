/**
 * These tests read source as text and never import the code under test, so they stay fast
 * enough for a pre-commit hook and cannot be broken by runtime wiring.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, posix, resolve } from "node:path";
import {
  matchesGlob as scopeGlob,
  sourceFiles as srcFiles,
} from "../../scripts/mutation-shards.mjs";

export const CLI_ROOT = resolve(import.meta.dirname, "..", "..");
export const SRC = join(CLI_ROOT, "src");

export const REPO_ROOT = resolve(CLI_ROOT, "..");

export function canonicalPath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function sourceFiles(): string[] {
  return srcFiles();
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
    throw new Error("no plugin README found — the scope of this rule is stale");
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
      const target = resolveImportTarget(file, match[1] as string);
      if (!known.has(target)) continue;
      const set = importers.get(target) ?? new Set<string>();
      set.add(file);
      importers.set(target, set);
    }
  }
  return importers;
}

/** The baseline may only shrink: a new violation fails, and so does removing one without
 * taking it out of the baseline. */
export function expectRatchet(
  current: readonly string[],
  baseline: readonly string[]
): { added: string[]; fixed: string[] } {
  const base = new Set(baseline);
  const now = new Set(current);
  return {
    added: current.filter((entry) => !base.has(entry)).sort(),
    fixed: baseline.filter((entry) => !now.has(entry)).sort(),
  };
}

/**
 * The subset of glob syntax this suite declares: a literal prefix, `/**\/` for any number of
 * directories *including none* — `src/shared/**\/*.ts` must match `src/shared/errors.ts` too,
 * or a scope silently covers only its subdirectories — and `*` within one segment.
 */
export function matchesGlob(glob: string, path: string): boolean {
  return scopeGlob(glob, path);
}

// The context graph: single source of truth for which context may import which. It lives here
// so `biome-context-parity.arch.test.ts` compares biome's own per-context `noRestrictedImports`
// overrides against this same data rather than a hand-copied list that only looks like it agrees.

export function contextNames(): string[] {
  return readdirSync(join(SRC, "contexts"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Exactly these edges between contexts, plus every context to shared. */
export const ALLOWED = new Set([
  "translate->tools",
  // The token a fetch carries (`contract/token-provider.ts`), until each of the two splits
  // from the host of the doctor and setup scenarios.
  "distribution->auth",
  // The token the changelog fetch carries (`contract/token-provider.ts`).
  "update->auth",
  // Installation reads the installed tools' profiles.
  "installation->tools",
  // Permanent: the target context map gives host-registration the contract of tools
  // (target/04-tools-and-translate.md, "Others reach tools only through its application/ and
  // contract/"). Biome keeps tools' domain and application out of reach.
  "host-registration->tools",
]);

/**
 * The ALLOWED rows that are debt rather than the target context map, each with the exact
 * `importer -> target` pairs that justify it. A stable row stays edge-level; a transitional one
 * admits these imports and no other, so a new import under an existing row fails instead of
 * riding in. The lists only shrink: a pair the code no longer holds fails until removed.
 */
export const TRANSITIONAL_PAIRS: Readonly<Record<string, readonly string[]>> = {};

/**
 * The contexts whose interior is held by Biome's folder groups instead of the public-surface
 * list in `context-boundary.arch.test.ts`: they publish `contract/` and `application/` and
 * keep the three folders below to themselves and the composition root. The list is data for
 * `biome-context-parity.arch.test.ts`, which computes the groups every importer must carry.
 */
export const HELD_BY_BIOME: readonly string[] = [
  "auth",
  "host-registration",
  "recipes",
  "telemetry",
  "tools",
  "translate",
  "update",
];

const INTERIOR_FOLDERS = ["domain", "ports", "infrastructure"] as const;

/** `tools` keeps its `application/` to the composition root too: what an outside caller asks of
 * a tool is in `contract/`, and the one application file builds the catalog the root hands out. */
const APPLICATION_CLOSED = new Set(["tools"]);

/** The groups that forbid a held context's interior to an importer that may reach the rest. */
export function interiorGroupsOf(context: string): string[] {
  const folders: readonly string[] = APPLICATION_CLOSED.has(context)
    ? [...INTERIOR_FOLDERS, "application"]
    : INTERIOR_FOLDERS;
  return folders
    .filter((folder) => existsSync(join(SRC, "contexts", context, folder)))
    .map((folder) => `**/${context}/${folder}/**`);
}

/**
 * Edges the chain forbids and the tree still has. The list may only shrink, and each entry
 * carries its measured weight: an edge alone could absorb any number of imports in silence.
 */
export const BASELINE: readonly {
  readonly edge: string;
  readonly imports: number;
  readonly files: number;
}[] = [];

export function contextOf(file: string): string {
  const inContext = /^src\/contexts\/([^/]+)\//.exec(file);
  if (inContext) return inContext[1] as string;
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

interface Crossing {
  readonly file: string;
  /** The module the import resolves to. */
  readonly target: string;
  readonly from: string;
  readonly to: string;
  /** `domain`, `application`, `infrastructure`, or a migrated context's `ports` or `contract`
   * or null when `file` is not itself under a context's own layer split (shared,
   * presentation). */
  readonly layer: "domain" | "application" | "infrastructure" | "ports" | "contract" | null;
}

const LAYER_OF_FILE = /^src\/contexts\/[^/]+\/(domain|application|infrastructure|ports|contract)\//;

/** Whether an import from one layer to another is an edge worth naming. Presentation may
 * reach down, so only the reverse is one. */
export function isCrossing(from: string, to: string): boolean {
  if (from === to || to === "shared") return false;
  if (from === "outside" || to === "outside") return false;
  return !BELOW_NOTHING.has(from);
}

/** The one walk every edge-shaped rule in this directory builds on. */
function crossings(files: readonly string[]): Crossing[] {
  const out: Crossing[] = [];
  for (const file of files) {
    const from = contextOf(file);
    const source = read(file);
    const layerMatch = LAYER_OF_FILE.exec(file);
    for (const match of source.matchAll(INTERNAL_IMPORT)) {
      const target = resolveImportTarget(file, match[1] as string);
      const to = contextOf(target);
      if (!isCrossing(from, to)) continue;
      out.push({ file, target, from, to, layer: (layerMatch?.[1] as Crossing["layer"]) ?? null });
    }
  }
  return out;
}

/**
 * Every `importer -> target` pair of a crossing from one context into another, in the shape a
 * rule below compares: a context never imports through shared, presentation or the composition
 * here, so only the two context-to-context walks are kept.
 */
export function contextImportPairs(
  files: readonly string[]
): { readonly edge: string; readonly importer: string; readonly target: string }[] {
  return crossings(files)
    .filter((crossing) => isContext(crossing.from) && isContext(crossing.to))
    .map(({ file, target, from, to }) => ({ edge: `${from}->${to}`, importer: file, target }));
}

export function weighedEdges(
  files: readonly string[]
): Map<string, { imports: number; files: number }> {
  const found = new Map<string, { imports: number; files: Set<string> }>();
  for (const crossing of crossings(files)) {
    const edge = `${crossing.from}->${crossing.to}`;
    const weight = found.get(edge) ?? { imports: 0, files: new Set<string>() };
    weight.imports += 1;
    weight.files.add(crossing.file);
    found.set(edge, weight);
  }
  return new Map(
    [...found].map(([edge, weight]) => [
      edge,
      { imports: weight.imports, files: weight.files.size },
    ])
  );
}

export function edgesBetweenContexts(files: readonly string[]): string[] {
  return [...weighedEdges(files).keys()].sort();
}

/** For each baselined edge, the layers of its `from` context that carry it — derived from the
 * same walk, so a debt file moving layer shows up without anyone updating a list. */
export function baselineLayers(files: readonly string[]): Map<string, Set<string>> {
  const baselineEdges = new Set(BASELINE.map((entry) => entry.edge));
  const layers = new Map<string, Set<string>>();
  for (const crossing of crossings(files)) {
    const edge = `${crossing.from}->${crossing.to}`;
    if (!baselineEdges.has(edge) || crossing.layer === null) continue;
    const set = layers.get(edge) ?? new Set<string>();
    set.add(crossing.layer);
    layers.set(edge, set);
  }
  return layers;
}

/**
 * Every invocation the CLI declares: a top-level verb, and each `noun verb` pair. The pair
 * matters — `aidd plugin marketplace add` passes any check reading only the first word.
 */
export function declaredCommands(): Set<string> {
  const declared = new Set<string>();
  for (const file of sourceFiles().filter((f) => f.startsWith("src/presentation/commands/"))) {
    const source = read(file);
    // `program.command("noun")` names a parent; every other `.command("verb")` in that file
    // is one of its subcommands.
    const parent = /program\s*\n?\s*\.?command\("([a-z][a-z-]*)"/.exec(source)?.[1];
    for (const match of source.matchAll(/\.command\("([a-z][a-z-]*)/g)) {
      declared.add(match[1] as string);
      if (parent !== undefined && match[1] !== parent) declared.add(`${parent} ${match[1]}`);
    }
  }
  // An empty set would clear every document at once: nothing can be undeclared when nothing
  // is declared.
  if (declared.size === 0) throw new Error("no command found — the scope of this rule is stale");
  return declared;
}

/** A placeholder, or a word a path continues right past: `aidd sync rules/naming.md` names a
 * file, and the `/` right after it is the tell no placeholder syntax gives. */
function isArgumentLike(word: string, trailing: string): boolean {
  return word.startsWith("<") || word.startsWith("[") || trailing.startsWith("/");
}

const INSTRUCTED_COMMAND = /\baidd ([a-z][a-z-]*)(?: ([a-z][a-z-]*)([^\s`]*))?/g;

/** `aidd <verb>` or `aidd <noun> <verb>` as it appears inside text, resolved against a
 * pair-aware declared set. */
export function unresolvedCommandMentions(text: string, declared: ReadonlySet<string>): string[] {
  const missing: string[] = [];
  for (const match of text.matchAll(INSTRUCTED_COMMAND)) {
    const [, first, second, trailing] = match;
    // A bare verb needs only itself declared — `aidd setup --ai` reads as one, a flag being
    // no word this pattern captures. A pair needs the pair.
    if (second === undefined) {
      if (!declared.has(first as string)) missing.push(first as string);
      continue;
    }
    if (declared.has(`${first} ${second}`)) continue;
    // A declared verb followed by something else is that verb plus an argument:
    // `aidd marketplace add` is a pair, `aidd update --force` is not.
    if (declared.has(first as string) && isArgumentLike(second, trailing ?? "")) continue;
    missing.push(`${first} ${second}`);
  }
  return missing;
}
