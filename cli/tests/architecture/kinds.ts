/**
 * The file-kind table: every file of `src/` and `tests/` is exactly one kind, and a kind says where
 * it lives, what it may import and which test it owes. `kinds.arch.test.ts` holds the tree to it;
 * `kinds-debt.json` lists what the tree still gets wrong.
 *
 * A file is recognised by its suffix (`<name>.use-case.ts`). A file with no kind suffix falls back
 * to the folder that owns a kind today, so the suffix rollout is not a violation of its own.
 * Written limits: an import is read by the one extractor in `helpers.ts`, so a specifier quoted in
 * a comment counts; an import that resolves to no file of the tree is not judged.
 */
import { readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { present } from "../shared/testing/present.js";
import { INTERNAL_IMPORT, matchesGlob, resolveImportTarget } from "./helpers.js";

export type KindId =
  | "use-case"
  | "model"
  | "port"
  | "adapter"
  | "profile"
  | "error"
  | "presenter"
  | "controller"
  | "composition"
  | "test"
  | "builder"
  | "fake"
  | "contract-suite";

export type TestLevel = "unit" | "contract" | "integration" | "golden" | "e2e" | "arch";

export interface Kind {
  readonly id: KindId;
  /** A file named like this is of the kind, whatever its folder. */
  readonly suffix: RegExp;
  /** Where a file with the suffix may sit. */
  readonly folders: readonly string[];
  /** A file with no kind suffix in these folders is of the kind, minus `except`. */
  readonly fallback: readonly string[];
  readonly except: readonly string[];
  /** The kinds a file of this kind may import, or any. */
  readonly imports: readonly KindId[] | "any";
  /** The node builtins and packages it may import, or any. */
  readonly externals: readonly string[] | "any";
  /** When set, an import must land in one of these folders. */
  readonly within?: readonly string[];
  /** A builder, fake or suite imports no other context's kit. */
  readonly ownKitOnly?: true;
  /** The levels of the test a source of this kind owes at its mirror path, none when it owes none. */
  readonly tests: readonly TestLevel[];
}

const PURE_BUILTINS = ["node:path", "node:crypto"];
const ANY_TEST_FOLDER = ["tests/**/*"];
const KIT_FOLDER = ["tests/**/testing/**/*"];

export const KINDS: readonly Kind[] = [
  {
    id: "use-case",
    suffix: /\.use-case\.ts$/,
    folders: ["src/contexts/*/application/**/*", "src/orchestration/**/*"],
    fallback: ["src/contexts/*/application/**/*", "src/orchestration/**/*"],
    except: ["src/orchestration/ports/**/*", "src/orchestration/domain/**/*"],
    imports: ["use-case", "model", "port", "error"],
    externals: "any",
    tests: ["unit"],
  },
  {
    id: "model",
    suffix: /\.model\.ts$/,
    folders: [
      "src/contexts/*/domain/**/*",
      "src/contexts/*/contract/**/*",
      "src/shared/domain/**/*",
      "src/orchestration/domain/**/*",
    ],
    fallback: [
      "src/contexts/*/domain/**/*",
      "src/contexts/*/contract/**/*",
      "src/shared/domain/**/*",
      "src/orchestration/domain/**/*",
    ],
    except: ["src/contexts/tools/domain/profiles/*/profile.ts"],
    imports: ["model"],
    externals: PURE_BUILTINS,
    tests: ["unit"],
  },
  {
    id: "port",
    suffix: /\.port\.ts$/,
    folders: [
      "src/contexts/*/ports/**/*",
      "src/contexts/*/contract/**/*",
      "src/shared/ports/**/*",
      "src/orchestration/ports/**/*",
    ],
    fallback: [
      "src/contexts/*/ports/**/*",
      "src/shared/ports/**/*",
      "src/orchestration/ports/**/*",
    ],
    except: [],
    imports: ["model", "port"],
    externals: [],
    tests: [],
  },
  {
    id: "adapter",
    suffix: /\.adapter\.ts$/,
    folders: [
      "src/contexts/*/infrastructure/**/*",
      "src/shared/infrastructure/**/*",
      "src/presentation/terminal/**/*",
    ],
    fallback: [
      "src/contexts/*/infrastructure/**/*",
      "src/shared/infrastructure/**/*",
      "src/presentation/terminal/**/*",
    ],
    except: [],
    imports: ["adapter", "model", "port", "error"],
    externals: "any",
    tests: ["integration", "contract"],
  },
  {
    id: "profile",
    suffix: /\.profile\.ts$/,
    folders: ["src/contexts/tools/domain/profiles/**/*"],
    fallback: ["src/contexts/tools/domain/profiles/*/profile.ts"],
    except: [],
    imports: ["model"],
    externals: PURE_BUILTINS,
    within: [
      "src/contexts/tools/domain/**/*",
      "src/contexts/tools/contract/**/*",
      "src/shared/domain/**/*",
    ],
    tests: ["unit"],
  },
  {
    id: "error",
    suffix: /\.error\.ts$/,
    folders: [
      "src/contexts/*/domain/**/*",
      "src/shared/domain/**/*",
      "src/orchestration/**/*",
      "src/presentation/**/*",
    ],
    fallback: [],
    except: [],
    imports: ["model", "error"],
    externals: [],
    tests: ["unit"],
  },
  {
    id: "presenter",
    suffix: /\.presenter\.ts$/,
    folders: [
      "src/presentation/presenters/**/*",
      "src/presentation/errors/**/*",
      "src/presentation/menu/**/*",
    ],
    fallback: [
      "src/presentation/presenters/**/*",
      "src/presentation/display/**/*",
      "src/presentation/errors/**/*",
      "src/presentation/menu/**/*",
    ],
    except: [],
    imports: ["model", "use-case", "presenter"],
    externals: "any",
    tests: ["golden"],
  },
  {
    id: "controller",
    suffix: /\.controller\.ts$/,
    folders: ["src/presentation/controllers/**/*", "src/presentation/hooks/**/*"],
    fallback: [
      "src/presentation/controllers/**/*",
      "src/presentation/commands/**/*",
      "src/presentation/hooks/**/*",
    ],
    except: [],
    imports: ["use-case", "presenter", "model", "controller"],
    externals: "any",
    tests: ["unit"],
  },
  {
    id: "composition",
    suffix: /\.composition\.ts$/,
    folders: ["src/composition/**/*"],
    fallback: ["src/composition/**/*"],
    except: [],
    imports: ["use-case", "adapter", "port", "model", "error", "profile", "composition"],
    externals: "any",
    tests: [],
  },
  {
    id: "test",
    suffix: /\.(?:unit|contract|integration|golden|e2e|arch)\.test\.ts$/,
    folders: ANY_TEST_FOLDER,
    fallback: [],
    except: [],
    imports: "any",
    externals: "any",
    tests: [],
  },
  {
    id: "builder",
    suffix: /\.builder\.ts$/,
    folders: KIT_FOLDER,
    fallback: [],
    except: [],
    imports: "any",
    externals: "any",
    ownKitOnly: true,
    tests: [],
  },
  {
    id: "fake",
    suffix: /\.fake\.ts$/,
    folders: KIT_FOLDER,
    fallback: [],
    except: [],
    imports: "any",
    externals: "any",
    ownKitOnly: true,
    tests: [],
  },
  {
    id: "contract-suite",
    suffix: /\.contract\.ts$/,
    folders: KIT_FOLDER,
    fallback: [],
    except: [],
    imports: "any",
    externals: "any",
    ownKitOnly: true,
    tests: [],
  },
];

/** Outside the catalog on purpose: the entry point, ambient declarations, glossaries, test data and
 * the architecture gate's own support files. */
export const OUTSIDE: readonly string[] = [
  "src/cli.ts",
  "src/**/*.d.ts",
  "src/**/*.md",
  "tests/fixtures/**/*",
  "tests/golden/snapshots/**/*",
  "tests/architecture/*.ts",
];

export type Rule =
  | "classification"
  | "imports"
  | "mirror"
  | "shape"
  | "thrown"
  | "instructs"
  | "composition"
  | "ports"
  | "sections"
  | "answers"
  | "repository"
  | "translate"
  | "size";

export interface Violation {
  readonly rule: Rule;
  /** What the debt file lists: the file, or `file -> target` for an import. */
  readonly entry: string;
  readonly message: string;
}

export interface Shape {
  readonly typeOnly: boolean;
  readonly behaviour: boolean;
}

const CODE_FILE = /\.(?:ts|mts|cts|js|mjs|cjs)$/;
/** The import reader of `helpers.ts` takes relative and `@/` specifiers. This one takes the rest,
 * from import and export statements only, so `Array.from(", ")` and a quoted sentence do not count. */
const EXTERNAL_IMPORT =
  /^\s*(?:import|export)\b[^"';]*?\bfrom\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/gm;
const PROFILE_FOLDER = "src/contexts/tools/domain/profiles/";
const SHARED_KIT = "tests/shared/testing/";
const FIX_CLASSIFY =
  "name it <name>.<kind>.ts in the folder of its kind, move it there, or list it in OUTSIDE if it is no kind";

const anyOf = (globs: readonly string[], path: string): boolean =>
  globs.some((glob) => matchesGlob(glob, path));

const article = (id: KindId): string => (id === "adapter" || id === "error" ? "an" : "a");

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
function soleKind(path: string, kinds: readonly Kind[]): Kind | undefined {
  const [first, second] = claimants(path, kinds);
  return second ? undefined : first;
}

export function classificationViolations(
  paths: readonly string[],
  kinds: readonly Kind[] = KINDS
): Violation[] {
  const out: Violation[] = [];
  for (const path of paths.filter(isInCatalog)) {
    const found = kindsOf(path, kinds);
    const sole = soleKind(path, kinds);
    const rule = "every file of src/ and tests/ is exactly one kind (tests/architecture/kinds.ts)";
    const report = (what: string, fix: string): void => {
      out.push({
        rule: "classification",
        entry: path,
        message: `${path}: ${what}. Rule: ${rule}. Fix: ${fix}.`,
      });
    };
    if (found.length === 0) report("matches no kind", FIX_CLASSIFY);
    else if (found.length > 1) {
      report(
        `matches ${found.length} kinds: ${found.join(", ")}`,
        "rename it or move it so one kind claims it"
      );
    } else if (sole) {
      const kind = sole;
      if (kind.suffix.test(path) && !anyOf(kind.folders, path)) {
        report(
          `is ${article(kind.id)} ${kind.id} by its suffix but sits outside the folders of ${article(kind.id)} ${kind.id} (${kind.folders.join(", ")})`,
          `move it into one of them, or rename it as the kind its folder holds`
        );
      }
    }
  }
  return out;
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

/** The folder that owns a kit file: everything before its `/testing/`. */
const kitOwner = (path: string): string | undefined => {
  const at = path.indexOf("/testing/");
  return at < 0 ? undefined : path.slice(0, at);
};

/** The tests of a context, and the helpers and shared kit that could hand a kit out, import their
 * own kit and the shared one. Orchestration, presentation, composition, e2e and golden tests compose
 * contexts and may import any kit. */
const KIT_BOUND = /^tests\/(?:contexts\/[^/]+|helpers|shared)\//;

const CONTEXT_KIT = /^tests\/contexts\/[^/]+\/testing\//;

/** The context folder a test of a context belongs to, else the folder of its kit. */
const kitHolder = (path: string): string | undefined =>
  /^tests\/contexts\/[^/]+/.exec(path)?.[0] ?? kitOwner(path);

/** The tool a profile file belongs to: a tool evolves inside its own folder. */
const profileOf = (path: string): string | undefined =>
  path.startsWith(PROFILE_FOLDER) ? path.slice(PROFILE_FOLDER.length).split("/")[0] : undefined;

function contextOfSource(path: string): string | undefined {
  return /^src\/contexts\/([^/]+)\//.exec(path)?.[1];
}

export function importViolations(
  files: Readonly<Record<string, string>>,
  kinds: readonly Kind[] = KINDS
): Violation[] {
  const known = new Set(Object.keys(files));
  const out: Violation[] = [];
  for (const [file, text] of Object.entries(files)) {
    if (!isInCatalog(file)) continue;
    const from = soleKind(file, kinds);
    const seen = new Set<string>();
    const report = (target: string, what: string, fix: string): void => {
      if (seen.has(target)) return;
      seen.add(target);
      out.push({
        rule: "imports",
        entry: `${file} -> ${target}`,
        message: `${file} -> ${target}: ${what}. Rule: imports follow the table in tests/architecture/kinds.ts. Fix: ${fix}.`,
      });
    };
    for (const match of text.matchAll(INTERNAL_IMPORT)) {
      const target = resolveImportTarget(file, present(match[1]));
      if (!known.has(target)) continue;
      const fromContext = contextOfSource(file);
      const toContext = contextOfSource(target);
      const owner = profileOf(file);
      const other = profileOf(target);
      if (owner && other && owner !== other) {
        report(
          target,
          `profile ${owner} imports a file of profile ${other}`,
          "move what the two tools share to domain/formats, domain/hooks or domain/bridges"
        );
        continue;
      }
      if (from?.within && !anyOf(from.within, target)) {
        report(
          target,
          `a ${from.id} may import only ${from.within.join(", ")}`,
          "import it through tools/contract or move the shared part to shared/domain"
        );
        continue;
      }
      if (
        fromContext &&
        toContext &&
        fromContext !== toContext &&
        !matchesGlob(`src/contexts/${toContext}/contract/**/*`, target)
      ) {
        report(
          target,
          `context ${fromContext} reaches into context ${toContext} past its contract`,
          `import ${toContext}'s contract, or expose what you need there`
        );
        continue;
      }
      if (
        (from?.ownKitOnly || (KIT_BOUND.test(file) && CONTEXT_KIT.test(target))) &&
        anyOf(KIT_FOLDER, target) &&
        !target.startsWith(SHARED_KIT) &&
        kitOwner(target) !== kitHolder(file)
      ) {
        report(
          target,
          `${from?.id ?? "a test file"} imports the kit of another folder`,
          "build it from the shared kit and the sources under test, or copy the part it needs"
        );
        continue;
      }
      const to = soleKind(target, kinds)?.id;
      if (from && to && from.id !== to && from.imports !== "any" && !from.imports.includes(to)) {
        report(
          target,
          `${from.id} may not import ${article(to)} ${to}`,
          `a ${from.id} may import only ${from.imports.join(", ")}; depend on one of those, or move the code to the kind that may`
        );
      }
    }
    if (from && from.externals !== "any") {
      for (const match of text.matchAll(EXTERNAL_IMPORT)) {
        const specifier = present(match[1] ?? match[2] ?? match[3]);
        if (/^(?:\.|@\/|\/)/.test(specifier) || from.externals.includes(specifier)) continue;
        report(
          specifier,
          `a ${from.id} may not import "${specifier}"`,
          from.externals.length === 0
            ? `a ${from.id} imports no package or node builtin; move the code that needs it to an adapter`
            : `a ${from.id} may import only ${from.externals.join(", ")}`
        );
      }
    }
  }
  return out;
}

export function mirrorViolations(
  sources: readonly string[],
  tests: readonly string[],
  shapeOf: (missing: readonly string[]) => ReadonlyMap<string, Shape>,
  kinds: readonly Kind[] = KINDS
): Violation[] {
  const owed: { source: string; kind: Kind; folder: string; base: string }[] = [];
  for (const source of sources.filter(isInCatalog)) {
    const kind = soleKind(source, kinds);
    if (!kind || kind.tests.length === 0) continue;
    const mirror = source.replace(/^src\//, "tests/").replace(/\.ts$/, "");
    const folder = posix.dirname(mirror);
    const base = posix.basename(mirror);
    const pattern = new RegExp(
      `^${escapeRegExp(folder)}/${escapeRegExp(base)}\\.(?:[\\w-]+\\.)*(?:${kind.tests.join("|")})\\.test\\.ts$`
    );
    if (!tests.some((test) => pattern.test(test))) owed.push({ source, kind, folder, base });
  }
  const shapes = shapeOf(owed.map((entry) => entry.source));
  const out: Violation[] = [];
  for (const { source, kind, folder, base } of owed) {
    const shape = shapes.get(source) ?? { typeOnly: false, behaviour: true };
    if (shape.typeOnly || (source.startsWith(PROFILE_FOLDER) && !shape.behaviour)) continue;
    const wanted = `${folder}/${base}.${kind.tests[0]}.test.ts`;
    out.push({
      rule: "mirror",
      entry: source,
      message: `${source}: ${article(kind.id)} ${kind.id} owes a ${kind.tests.join(" or ")} test at its mirror path. Rule: a source is tested at the same path under tests/ (tests/architecture/kinds.ts). Fix: add ${wanted}, with a facet before the level if the test is split.`,
    });
  }
  return out;
}

const escapeRegExp = (literal: string): string => literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type Debt = Readonly<Record<Rule, readonly string[]>>;

const RULES: readonly Rule[] = [
  "classification",
  "imports",
  "mirror",
  "shape",
  "thrown",
  "instructs",
  "composition",
  "ports",
  "sections",
  "answers",
  "repository",
  "translate",
  "size",
];

/** A debt that lists nothing. */
export const noDebt = (): Debt => ({
  classification: [],
  imports: [],
  mirror: [],
  shape: [],
  thrown: [],
  instructs: [],
  composition: [],
  ports: [],
  sections: [],
  answers: [],
  repository: [],
  translate: [],
  size: [],
});

/** The debt file, a rule it does not name counting as none. */
export function loadDebt(): Debt {
  const raw: Partial<Debt> = JSON.parse(
    readFileSync(join(import.meta.dirname, "kinds-debt.json"), "utf8")
  );
  return { ...noDebt(), ...raw };
}

/** `unlisted`: violations the debt does not hold. `stale`: debt entries that no longer violate.
 * A check that finds the violations of some rules only names those rules. */
export function debtVerdict(
  found: readonly Violation[],
  debt: Debt,
  rules: readonly Rule[] = RULES
): { unlisted: Violation[]; stale: string[] } {
  const listed = new Set(rules.flatMap((rule) => debt[rule].map((entry) => `${rule}: ${entry}`)));
  const present = new Set(found.map((violation) => `${violation.rule}: ${violation.entry}`));
  return {
    unlisted: found.filter((violation) => !listed.has(`${violation.rule}: ${violation.entry}`)),
    stale: [...listed].filter((key) => !present.has(key)),
  };
}
