/**
 * The import rules of the kind gate: what a file may import, judged edge by edge against the kind
 * table and the context map. `kinds.arch.test.ts` holds the tree to them, with no violation
 * tolerated.
 *
 * Written limits: an import is read by the one extractor in `source-graph.ts`, so a specifier quoted in
 * a comment counts; an import that resolves to no file of the tree is not judged.
 */
import { present } from "../shared/testing/present.builder.js";
import { ALLOWED } from "./allowed-edges.js";
import { KINDS, KIT_FOLDER, type Kind, SETUP_FOLDER } from "./kind-table.js";
import { anyOf, article, contextOfSource, isInCatalog, soleKind, type Violation } from "./kinds.js";
import { INTERNAL_IMPORT, matchesGlob, resolveImportTarget } from "./source-graph.js";

/** The import reader of `source-graph.ts` takes relative and `@/` specifiers. This one takes the rest,
 * from import and export statements only, so `Array.from(", ")` and a quoted sentence do not count. */
const EXTERNAL_IMPORT =
  /^\s*(?:import|export)\b[^"';]*?\bfrom\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/gm;
const PROFILE_FOLDER = "src/contexts/tools/domain/profiles/";
const SHARED_KIT = "tests/shared/testing/";

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

/** The layer a source file belongs to: a context by name, `shared`, or one of the three layers a
 * context never reaches back into. */
function layerOf(path: string): string | undefined {
  const inContext = contextOfSource(path);
  if (inContext) return inContext;
  if (path.startsWith("src/shared/")) return "shared";
  return ["presentation", "composition", "orchestration"].find((layer) =>
    path.startsWith(`src/${layer}/`)
  );
}

/** The edge an import draws from a context or `shared` to another layer, when the context map
 * (`ALLOWED`) does not admit it. Presentation, composition and orchestration may reach down, and
 * everything may reach `shared`. */
function forbiddenEdge(file: string, target: string): string | undefined {
  const from = layerOf(file);
  const to = layerOf(target);
  if (!from || !to || from === to || to === "shared") return undefined;
  if (from !== "shared" && !contextOfSource(file)) return undefined;
  const edge = `${from}->${to}`;
  return ALLOWED.has(edge) ? undefined : edge;
}

/** One import of a file, with the kind of the file that holds it. */
interface Edge {
  readonly file: string;
  readonly target: string;
  readonly from: Kind | undefined;
  readonly kinds: readonly Kind[];
}

interface Break {
  readonly what: string;
  readonly fix: string;
}

const crossesProfile = ({ file, target }: Edge): Break | undefined => {
  const owner = profileOf(file);
  const other = profileOf(target);
  return owner && other && owner !== other
    ? {
        what: `profile ${owner} imports a file of profile ${other}`,
        fix: "move what the two tools share to domain/formats, domain/hooks or domain/bridges",
      }
    : undefined;
};

const leavesWithin = ({ from, target }: Edge): Break | undefined =>
  from?.within && !anyOf(from.within, target)
    ? {
        what: `a ${from.id} may import only ${from.within.join(", ")}`,
        fix: "import it through tools/contract or move the shared part to shared/domain",
      }
    : undefined;

const leavesContextMap = ({ file, target }: Edge): Break | undefined => {
  const edge = forbiddenEdge(file, target);
  return edge
    ? {
        what: `the edge ${edge} is not in the context map`,
        fix: "add the row to ALLOWED in allowed-edges.ts if the target context map admits it, else depend on shared or a contract",
      }
    : undefined;
};

const reachesPastContract = ({ file, target }: Edge): Break | undefined => {
  const fromContext = contextOfSource(file);
  const toContext = contextOfSource(target);
  const crosses = fromContext && toContext && fromContext !== toContext;
  return crosses && !matchesGlob(`src/contexts/${toContext}/contract/**/*`, target)
    ? {
        what: `context ${fromContext} reaches into context ${toContext} past its contract`,
        fix: `import ${toContext}'s contract, or expose what you need there`,
      }
    : undefined;
};

const importsSetup = ({ file, target }: Edge): Break | undefined =>
  anyOf(SETUP_FOLDER, target) && !anyOf(SETUP_FOLDER, file)
    ? {
        what: "a setup file is imported by a test file or a source",
        fix: "only a vitest config loads a file of tests/setup; move what a test needs to a kit",
      }
    : undefined;

const importsOtherKit = ({ file, target, from }: Edge): Break | undefined => {
  const bound = from?.ownKitOnly || (KIT_BOUND.test(file) && CONTEXT_KIT.test(target));
  return bound &&
    anyOf(KIT_FOLDER, target) &&
    !target.startsWith(SHARED_KIT) &&
    kitOwner(target) !== kitHolder(file)
    ? {
        what: `${from?.id ?? "a test file"} imports the kit of another folder`,
        fix: "build it from the shared kit and the sources under test, or copy the part it needs",
      }
    : undefined;
};

const importsForbiddenKind = ({ target, from, kinds }: Edge): Break | undefined => {
  const to = soleKind(target, kinds)?.id;
  const forbidden =
    from && to && from.id !== to && from.imports !== "any" && !from.imports.includes(to);
  return forbidden
    ? {
        what: `${from.id} may not import ${article(to)} ${to}`,
        fix: `a ${from.id} may import only ${from.imports.join(", ")}; depend on one of those, or move the code to the kind that may`,
      }
    : undefined;
};

/** In order: the first rule an import breaks is the one reported. */
const EDGE_RULES: readonly ((edge: Edge) => Break | undefined)[] = [
  crossesProfile,
  leavesWithin,
  leavesContextMap,
  reachesPastContract,
  importsSetup,
  importsOtherKit,
  importsForbiddenKind,
];

const firstBreak = (edge: Edge): Break | undefined => {
  for (const rule of EDGE_RULES) {
    const found = rule(edge);
    if (found) return found;
  }
  return undefined;
};

const violationOf = (file: string, target: string, { what, fix }: Break): Violation => ({
  rule: "imports",
  entry: `${file} -> ${target}`,
  message: `${file} -> ${target}: ${what}. Rule: imports follow the table in tests/architecture/kinds.ts. Fix: ${fix}.`,
});

/** The package or builtin each external import names, which the kind does not admit. */
function externalBreaks(text: string, from: Kind): [string, Break][] {
  if (from.externals === "any") return [];
  const { externals } = from;
  return [...text.matchAll(EXTERNAL_IMPORT)]
    .map((match) => present(match[1] ?? match[2] ?? match[3]))
    .filter((specifier) => !/^(?:\.|@\/|\/)/.test(specifier) && !externals.includes(specifier))
    .map((specifier) => [
      specifier,
      {
        what: `a ${from.id} may not import "${specifier}"`,
        fix:
          externals.length === 0
            ? `a ${from.id} imports no package or node builtin; move the code that needs it to an adapter`
            : `a ${from.id} may import only ${externals.join(", ")}`,
      },
    ]);
}

function fileImportViolations(
  file: string,
  text: string,
  known: ReadonlySet<string>,
  kinds: readonly Kind[]
): Violation[] {
  const from = soleKind(file, kinds);
  const internal = [...text.matchAll(INTERNAL_IMPORT)]
    .map((match) => resolveImportTarget(file, present(match[1])))
    .filter((target) => known.has(target))
    .flatMap((target): [string, Break][] => {
      const found = firstBreak({ file, target, from, kinds });
      return found ? [[target, found]] : [];
    });
  const external = from ? externalBreaks(text, from) : [];
  const seen = new Set<string>();
  return [...internal, ...external]
    .filter(([target]) => !seen.has(target) && seen.add(target))
    .map(([target, found]) => violationOf(file, target, found));
}

export function importViolations(
  files: Readonly<Record<string, string>>,
  kinds: readonly Kind[] = KINDS
): Violation[] {
  const known = new Set(Object.keys(files));
  return Object.entries(files)
    .filter(([file]) => isInCatalog(file))
    .flatMap(([file, text]) => fileImportViolations(file, text, known, kinds));
}
