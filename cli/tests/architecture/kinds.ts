/**
 * The file-kind table: every file of `src/` and `tests/` is exactly one kind, and a kind says where
 * it lives, what it may import and which test it owes. `kinds.arch.test.ts` holds the tree to it,
 * with no violation tolerated. The table is in `kind-table.ts`, the import rules in `kind-imports.ts`.
 *
 * A file is recognised by its suffix (`<name>.use-case.ts`). A file with no kind suffix falls back
 * to the folder that owns a kind today, so the suffix rollout is not a violation of its own.
 */
import { posix } from "node:path";
import { KINDS, type Kind, type KindId, OUTSIDE } from "./kind-table.js";
import { matchesGlob } from "./source-graph.js";

export type Rule =
  | "classification"
  | "imports"
  | "mirror"
  | "shape"
  | "thrown"
  | "errorText"
  | "instructs"
  | "composition"
  | "ports"
  | "sections"
  | "answers"
  | "repository"
  | "manifestSpelling"
  | "scope"
  | "binary"
  | "profile"
  | "controllerBuildsError"
  | "size"
  | "purity"
  | "toolsAdapter"
  | "domainAsset";

export interface Violation {
  readonly rule: Rule;
  /** What the violation names: the file, or `file -> target` for an import. */
  readonly entry: string;
  readonly message: string;
}

export interface Shape {
  readonly typeOnly: boolean;
  readonly behaviour: boolean;
}

const CODE_FILE = /\.(?:ts|mts|cts|js|mjs|cjs)$/;
const PROFILE_FOLDERS = ["src/composition/tool-profiles/", "src/contexts/tools/domain/behaviours/"];
const FIX_CLASSIFY =
  "name it <name>.<kind>.ts in the folder of its kind, move it there, or list it in OUTSIDE if it is no kind";

export const anyOf = (globs: readonly string[], path: string): boolean =>
  globs.some((glob) => matchesGlob(glob, path));

export const article = (id: KindId): string => (id === "adapter" || id === "error" ? "an" : "a");

export function isInCatalog(path: string): boolean {
  if (!CODE_FILE.test(path)) return false;
  const testKind = KINDS.find((kind) => kind.id === "test");
  if (testKind?.suffix.test(path)) return true;
  return !anyOf(OUTSIDE, path);
}

/** The kinds that claim a file: the suffix decides, a file with none takes the kind of its folder. */
function claimants(path: string, kinds: readonly Kind[]): Kind[] {
  const bySuffix = kinds.filter((kind) => kind.suffix.test(path));
  return bySuffix.length > 0
    ? bySuffix
    : kinds.filter((kind) => anyOf(kind.fallback, path) && !anyOf(kind.except, path));
}

export function kindsOf(path: string, kinds: readonly Kind[] = KINDS): KindId[] {
  return claimants(path, kinds).map((kind) => kind.id);
}

/** The kind of a file that exactly one kind claims. */
export function soleKind(path: string, kinds: readonly Kind[]): Kind | undefined {
  const [first, second] = claimants(path, kinds);
  return second ? undefined : first;
}

interface Break {
  readonly what: string;
  readonly fix: string;
}

function classificationBreak(path: string, kinds: readonly Kind[]): Break | undefined {
  const found = kindsOf(path, kinds);
  if (found.length === 0) return { what: "matches no kind", fix: FIX_CLASSIFY };
  if (found.length > 1) {
    return {
      what: `matches ${found.length} kinds: ${found.join(", ")}`,
      fix: "rename it or move it so one kind claims it",
    };
  }
  const kind = soleKind(path, kinds);
  if (!kind?.suffix.test(path) || anyOf(kind.folders, path)) return undefined;
  return {
    what: `is ${article(kind.id)} ${kind.id} by its suffix but sits outside the folders of ${article(kind.id)} ${kind.id} (${kind.folders.join(", ")})`,
    fix: "move it into one of them, or rename it as the kind its folder holds",
  };
}

export function classificationViolations(
  paths: readonly string[],
  kinds: readonly Kind[] = KINDS
): Violation[] {
  const rule = "every file of src/ and tests/ is exactly one kind (tests/architecture/kinds.ts)";
  return paths.filter(isInCatalog).flatMap((path) => {
    const found = classificationBreak(path, kinds);
    return found
      ? [
          {
            rule: "classification" as const,
            entry: path,
            message: `${path}: ${found.what}. Rule: ${rule}. Fix: ${found.fix}.`,
          },
        ]
      : [];
  });
}

/** The use-case files, by the kind table: the files whose shape `use-case-shape.ts` reads. */
export const isUseCase = (path: string): boolean => {
  const found = kindsOf(path);
  return found.length === 1 && found[0] === "use-case" && isInCatalog(path);
};

/** One violation per use-case file that breaks its shape, listing every break. */
export function shapeViolations(breaks: ReadonlyMap<string, readonly string[]>): Violation[] {
  return [...breaks].map(([file, list]) => ({
    rule: "shape",
    entry: file,
    message: `${file}: ${list.join("; ")}. Rule: a use case is one class named after its file with a public execute, at most five constructor dependencies, and the tool catalog at construction (tests/architecture/kinds.ts). Fix: split the class by question, name it after the file, take the catalog in the constructor.`,
  }));
}

/** A file of `src/` that is neither source nor a glossary: a BSD `sed -i -E` leaves a `<file>-E`
 * backup that no gate reads, and a committed one ships as dead code. */
export function strayViolations(allPaths: readonly string[]): Violation[] {
  return allPaths
    .filter((path) => path.startsWith("src/") && !/\.(?:ts|md)$/.test(path))
    .map((path) => ({
      rule: "classification",
      entry: path,
      message: `${path}: a file of src/ is neither .ts nor .md. Rule: src/ holds source and glossaries only (tests/architecture/kinds.ts). Fix: delete it, such as a sed backup.`,
    }));
}

export function contextOfSource(path: string): string | undefined {
  return /^src\/contexts\/([^/]+)\//.exec(path)?.[1];
}

interface Owed {
  readonly source: string;
  readonly kind: Kind;
  readonly folder: string;
  readonly base: string;
}

/** The test a source owes at its mirror path, when none of the tests is it. */
function owedTest(
  source: string,
  tests: readonly string[],
  kinds: readonly Kind[]
): Owed | undefined {
  const kind = soleKind(source, kinds);
  if (!kind || kind.tests.length === 0) return undefined;
  const mirror = source.replace(/^src\//, "tests/").replace(/\.ts$/, "");
  const folder = posix.dirname(mirror);
  const base = posix.basename(mirror);
  const pattern = new RegExp(
    `^${escapeRegExp(folder)}/${escapeRegExp(base)}\\.(?:[\\w-]+\\.)*(?:${kind.tests.join("|")})\\.test\\.ts$`
  );
  return tests.some((test) => pattern.test(test)) ? undefined : { source, kind, folder, base };
}

const excusedByShape = (source: string, shape: Shape): boolean =>
  shape.typeOnly ||
  (PROFILE_FOLDERS.some((folder) => source.startsWith(folder)) && !shape.behaviour);

export function mirrorViolations(
  sources: readonly string[],
  tests: readonly string[],
  shapeOf: (missing: readonly string[]) => ReadonlyMap<string, Shape>,
  kinds: readonly Kind[] = KINDS
): Violation[] {
  const owed = sources
    .filter(isInCatalog)
    .flatMap((source) => owedTest(source, tests, kinds) ?? []);
  const shapes = shapeOf(owed.map((entry) => entry.source));
  return owed
    .filter(
      ({ source }) =>
        !excusedByShape(source, shapes.get(source) ?? { typeOnly: false, behaviour: true })
    )
    .map(({ source, kind, folder, base }) => ({
      rule: "mirror",
      entry: source,
      message: `${source}: ${article(kind.id)} ${kind.id} owes a ${kind.tests.join(" or ")} test at its mirror path. Rule: a source is tested at the same path under tests/ (tests/architecture/kinds.ts). Fix: add ${folder}/${base}.${kind.tests[0]}.test.ts, with a facet before the level if the test is split.`,
    }));
}

const escapeRegExp = (literal: string): string => literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
