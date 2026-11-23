/**
 * The rules of the kind gate that read a file's content rather than its name: an error class is
 * thrown, a message names a command that exists, a port method has a caller, a test reaches the
 * repository through the repository-root builder. Each takes the files as text and returns violations;
 * `kinds.rules.arch.test.ts` holds the tree to them, with no violation tolerated. The rules about
 * plugin sections and answers are in `kind-answer-rules.ts`.
 *
 * Written limits: a call is spelled as `.method(` in another file and nothing proves a real path
 * reaches it; an error thrown through a variable (`throw error`) is not seen.
 */
import {
  isCallExpression,
  isClassDeclaration,
  isInterfaceDeclaration,
  isMethodSignatureDeclaration,
  isNewExpression,
  isNoSubstitutionTemplateLiteral,
  isStringLiteral,
  isTemplateExpression,
  isThrowStatement,
  type MethodSignatureDeclaration,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { present } from "../shared/testing/present.builder.js";
import { literalsOf, nameText, readEach, violation } from "./kind-rule-support.js";
import type { KindId } from "./kind-table.js";
import { kindsOf, type Violation } from "./kinds.js";
import { PROFILE_MODULE_FILE, profileReaders, wholeProfileFlows } from "./profile-flow.js";
import { INTERNAL_IMPORT, resolveImportTarget, unresolvedCommandMentions } from "./source-graph.js";
import { walk } from "./ts-project.js";

const hasModifier = (node: Node, kind: SyntaxKind): boolean =>
  "modifiers" in node &&
  Array.isArray(node.modifiers) &&
  node.modifiers.some((m) => m.kind === kind);

// An error is thrown.

/** What a node raises: `throw <x>` and `reject(<x>)`. */
const raisedBy = (node: Node): Node | undefined => {
  if (isThrowStatement(node)) return node.expression;
  return isCallExpression(node) && nameText(node.expression) === "reject"
    ? node.arguments[0]
    : undefined;
};

/** The name of each error a file throws: `throw new X` and `reject(new X)`. */
function thrownIn(root: SourceFile): string[] {
  const thrown: string[] = [];
  walk(root, (node) => {
    const raised = raisedBy(node);
    const name = raised && isNewExpression(raised) ? nameText(raised.expression) : undefined;
    if (name) thrown.push(name);
  });
  return thrown;
}

function declaredErrors(root: SourceFile): string[] {
  return root.statements
    .filter(isClassDeclaration)
    .filter(
      (declaration) =>
        hasModifier(declaration, SyntaxKind.ExportKeyword) &&
        !hasModifier(declaration, SyntaxKind.AbstractKeyword) &&
        declaration.heritageClauses?.some((clause) => clause.token === SyntaxKind.ExtendsKeyword)
    )
    .flatMap((declaration) => (declaration.name ? [declaration.name.text] : []));
}

/** An error class no file throws: `knip` reads an error imported by its own test as used. The
 * declaring files are left out of the search, so a class cannot outlive its throwers by naming
 * itself once. */
export function errorViolations(
  files: Readonly<Record<string, string>>,
  declaring: readonly string[]
): Violation[] {
  const [declared, thrown] = [
    readEach(
      Object.fromEntries(declaring.map((path) => [path, present(files[path])])),
      (path, root) => declaredErrors(root).map((name) => ({ path, name }))
    ),
    new Set(
      readEach(
        Object.fromEntries(
          Object.entries(files).filter(
            ([path, text]) => !declaring.includes(path) && /\bthrow\b|\breject\b/.test(text)
          )
        ),
        (_path, root) => thrownIn(root)
      )
    ),
  ];
  return declared
    .filter(({ name }) => !thrown.has(name))
    .map(({ path, name }) =>
      violation(
        "thrown",
        `${path} :: ${name}`,
        "declared and never thrown",
        "an error class is thrown by some file",
        "throw it where the code path is, or delete the class"
      )
    );
}

// An error carries no text.

/** A `super(` call of an error class that hands the base a string or a template: the words live in
 * the presentation table. The empty string the base itself passes to `Error` is no text. */
export function errorTextViolations(files: Readonly<Record<string, string>>): Violation[] {
  const declaring = Object.fromEntries(
    Object.entries(files).filter(([path]) => path.endsWith(".error.ts"))
  );
  return readEach(declaring, (path, root) => {
    const found: Violation[] = [];
    walk(root, (node) => {
      if (!isCallExpression(node) || node.expression.kind !== SyntaxKind.SuperKeyword) return;
      const texts = node.arguments.some(
        (argument) =>
          ((isStringLiteral(argument) || isNoSubstitutionTemplateLiteral(argument)) &&
            argument.text !== "") ||
          isTemplateExpression(argument)
      );
      if (texts) {
        found.push(
          violation(
            "errorText",
            path,
            "an error hands its base a text",
            "an error carries a code and its data, never text",
            "move the words to src/presentation/errors/error-messages.presenter.ts"
          )
        );
      }
    });
    return found;
  });
}

// A message that instructs names a command that exists.

/** A string a person reads naming `aidd <command>` the CLI does not declare. */
export function instructionViolations(
  files: Readonly<Record<string, string>>,
  declared: ReadonlySet<string>
): Violation[] {
  const candidates = Object.fromEntries(
    Object.entries(files).filter(([, text]) => text.includes("aidd "))
  );
  return readEach(candidates, (path, root) =>
    literalsOf(root).flatMap((text) =>
      unresolvedCommandMentions(text, declared).map((command) =>
        violation(
          "instructs",
          `${path}: aidd ${command}`,
          "tells the user to run a command the CLI does not declare",
          "a message that instructs names a command that exists",
          "name the command the CLI declares, or drop the instruction"
        )
      )
    )
  );
}

// Composition holds one module per context.

const FIXED_MODULES = ["container", "shared", "tool-profiles.composition", "user-config-dir"];
const CONTEXT_FOLDER = "contexts";
const ALLOWED_SUBFOLDERS = [CONTEXT_FOLDER, "orchestration", "tool-profiles"];

/** The root, the shared module, one module per context in `contexts/`, and only `contexts/` and
 * `orchestration/` as folders. */
export function compositionViolations(
  files: readonly string[],
  contexts: readonly string[],
  dir = "src/composition"
): Violation[] {
  const inside = files
    .filter((file) => file.startsWith(`${dir}/`))
    .map((f) => f.slice(dir.length + 1));
  const modulesOf = (prefix: string) =>
    inside
      .filter((f) => f.startsWith(prefix) && !f.slice(prefix.length).includes("/"))
      .map((f) => f.slice(prefix.length).replace(/\.ts$/, ""));
  const folders = new Set(
    inside.filter((f) => f.includes("/")).map((f) => present(f.split("/")[0]))
  );
  const report = (entry: string, what: string): Violation =>
    violation(
      "composition",
      entry,
      what,
      "composition holds container, shared, the tool registration list, the user configuration directory, one module per context in contexts/, an orchestration folder and the tool profiles",
      "add the module of the context in contexts/, or remove the one no context owns"
    );
  const mismatches = (modules: string[], expected: readonly string[], where: string) => [
    ...expected
      .filter((name) => !modules.includes(name))
      .map((name) => report(`missing module: ${where}${name}`, `no module wires ${name}`)),
    ...modules
      .filter((name) => !expected.includes(name))
      .map((name) => report(`extra module: ${where}${name}`, `${name} does not belong here`)),
  ];
  return [
    ...mismatches(modulesOf(""), FIXED_MODULES, ""),
    ...mismatches(modulesOf(`${CONTEXT_FOLDER}/`), contexts, `${CONTEXT_FOLDER}/`),
    ...[...folders]
      .filter((name) => !ALLOWED_SUBFOLDERS.includes(name))
      .map((name) => report(`unexpected subfolder: ${name}`, `${dir}/${name} is no module`)),
  ];
}

// A port declares nothing nobody calls.

/** "ports" and "contract" must be their own path segment: a substring check also matches
 * `supports/` and `reports/`. A `contract/` file is a port the context offers others. */
export const isPortFile = (path: string): boolean => /(^|\/)(ports|contract)\//.test(path);

const isOptional = (method: MethodSignatureDeclaration): boolean =>
  method.postfixToken?.kind === SyntaxKind.QuestionToken;

const isCalledElsewhere = (
  name: string,
  path: string,
  bodies: ReadonlyMap<string, string>
): boolean =>
  [...bodies].some(([file, body]) => file !== path && new RegExp(`\\.${name}\\s*\\(`).test(body));

function methodViolations(
  path: string,
  owner: string,
  method: MethodSignatureDeclaration,
  bodies: ReadonlyMap<string, string>
): Violation[] {
  const name = nameText(method.name);
  if (!name) return [];
  const entry = `${path} :: ${owner}.${name}`;
  return [
    ...(isOptional(method)
      ? [
          violation(
            "ports",
            entry,
            "an optional method",
            "a port declares no optional method",
            "split it into a second port the holder asks for"
          ),
        ]
      : []),
    ...(isCalledElsewhere(name, path, bodies)
      ? []
      : [
          violation(
            "ports",
            entry,
            "no file spells it as a call",
            "a port declares no method nobody calls",
            "add the caller, or delete the method"
          ),
        ]),
  ];
}

/** A method of a port nobody spells as a call, and an optional method, which hides a second port
 * behind a `!== undefined` branch. An adapter implementing a method is not a caller. */
export function portViolations(bodies: ReadonlyMap<string, string>): Violation[] {
  const ports = Object.fromEntries([...bodies].filter(([path]) => isPortFile(path)));
  return readEach(ports, (path, root) =>
    root.statements
      .filter(isInterfaceDeclaration)
      .flatMap((declaration) =>
        declaration.members
          .filter(isMethodSignatureDeclaration)
          .flatMap((method) => methodViolations(path, declaration.name.text, method, bodies))
      )
  );
}

const DRIVING_PORT = "src/orchestration/deps.ts";

const drivingImportProblem = (typeOnly: boolean, specifier: string): string | undefined => {
  if (!typeOnly) return "is a value import";
  return /\/(?:application|contract)\//.test(specifier)
    ? undefined
    : "is neither application nor contract";
};

/** The context imports of the driving port that are not an `import type` of an application or a
 * contract file. */
export function drivingPortViolations(files: Readonly<Record<string, string>>): Violation[] {
  const text = files[DRIVING_PORT];
  if (text === undefined) return [];
  return [...text.matchAll(/^import\s+(type\s+)?[^;]*?from\s+"([^"]+)"/gms)].flatMap((match) => {
    const specifier = present(match[2]);
    const problem = specifier.startsWith("../contexts/")
      ? drivingImportProblem(match[1] !== undefined, specifier)
      : undefined;
    return problem
      ? [
          violation(
            "imports",
            `${DRIVING_PORT} -> ${specifier}`,
            `${specifier} ${problem}`,
            "the driving port names context types only, by import type, from application or contract",
            "import type the application or contract type it needs"
          ),
        ]
      : [];
  });
}

const contextOfFile = (path: string): string | undefined =>
  /^src\/contexts\/([^/]+)\//.exec(path)?.[1];

/** The files another context reads: the composition root and the driving port wire everything, so
 * they read nothing in particular. */
const readFromOutside = (files: Readonly<Record<string, string>>): Set<string> =>
  new Set(
    Object.entries(files)
      .filter(([importer]) => !importer.startsWith("src/composition/") && importer !== DRIVING_PORT)
      .flatMap(([importer, text]) =>
        [...text.matchAll(INTERNAL_IMPORT)]
          .map((match) => resolveImportTarget(importer, present(match[1])))
          .filter((target) => contextOfFile(target) !== contextOfFile(importer))
      )
  );

/** A `contract/` file nobody outside its context reads. The composition root and the driving port
 * do not count: they wire everything. Such a file is an interior file in the wrong folder, or a
 * surface nobody asked for. */
export function contractReaderViolations(files: Readonly<Record<string, string>>): Violation[] {
  const read = readFromOutside(files);
  return Object.keys(files)
    .filter((path) => /^src\/contexts\/[^/]+\/contract\//.test(path) && !read.has(path))
    .sort()
    .map((path) =>
      violation(
        "imports",
        path,
        "no file outside its context reads this contract file",
        "what a context publishes in contract/ exists for a reader outside it",
        "move it to the interior folder it belongs to, or delete it"
      )
    );
}

const CLASS_DECLARATION = /^export (?:abstract )?class (\w+)/gm;
const BUILT_KINDS: readonly KindId[] = ["adapter", "use-case"];

/** A class of an adapter, a use case or an orchestration file that any file outside
 * `composition/` builds with `new`. Presentation parses arguments and displays results, a use case
 * runs one operation, an adapter talks to one system: `composition/` builds the command or the
 * adapter and hands it in, so nothing decides which collaborator backs it. The kind of a file
 * decides, by suffix or by its folder, so a class named otherwise than `*.adapter.ts` is held too.
 * A class declared in a file of another kind (error, model, controller) is not built by composition. */
export function constructionViolations(files: Readonly<Record<string, string>>): Violation[] {
  const composed = Object.entries(files)
    .filter(([path]) => kindsOf(path).some((kind) => BUILT_KINDS.includes(kind)))
    .flatMap(([, text]) => [...text.matchAll(CLASS_DECLARATION)].map((match) => present(match[1])));
  return Object.entries(files)
    .filter(([path]) => path.startsWith("src/") && !path.startsWith("src/composition/"))
    .flatMap(([path, text]) =>
      [...new Set(composed)]
        .filter((name) => new RegExp(`\\bnew ${name}\\(`).test(text))
        .sort()
        .map((name) =>
          violation(
            "composition",
            `${path} :: new ${name}`,
            `builds ${name}`,
            "only composition builds a command, a use case or an adapter",
            "build it in composition/ and hand it in"
          )
        )
    );
}

/** A file outside the tools context that asks the catalog for a profile and passes it into a
 * parameter typed as the whole profile. Biome holds the half that names the whole profile in an
 * import; this half needs types, so the compiler reads the project at `cwd`. A reader names the
 * sections of a tool it reads, in its own ports. */
export function profileViolations(
  texts: Readonly<Record<string, string>>,
  cwd: string
): Violation[] {
  const { readers, handsOn } = profileReaders(texts);
  return wholeProfileFlows(cwd, PROFILE_MODULE_FILE, readers, handsOn).map((path) =>
    violation(
      "profile",
      path,
      "passes a catalog profile into a whole-profile parameter",
      "a reader outside tools names the sections of a tool it reads, never the whole profile",
      "name the sections it reads, in its own ports/"
    )
  );
}

const ERROR_IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"[^"]*\.error\.js"/g;

/** The error classes a controller builds with `new`. Importing one to test it is no violation;
 * building one is a decision the scenario owns. A name is read from an import of an `*.error.ts`. */
export function controllerBuildsErrorViolations(
  files: Readonly<Record<string, string>>
): Violation[] {
  return Object.entries(files)
    .filter(([path]) => kindsOf(path).includes("controller"))
    .flatMap(([path, text]) =>
      [...text.matchAll(ERROR_IMPORT)]
        .flatMap((match) =>
          present(match[1])
            .split(",")
            .map((name) => name.trim().replace(/^type\s+/, ""))
        )
        .filter((name) => new RegExp(`\\bnew ${name}\\(`).test(text))
        .sort()
        .map((name) =>
          violation(
            "controllerBuildsError",
            `${path} :: new ${name}`,
            `builds ${name}`,
            "a controller builds no error: the scenario decides and the translator renders",
            "return the outcome and let the scenario throw it"
          )
        )
    );
}
