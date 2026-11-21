/**
 * The rules of the kind gate that read a file's content rather than its name: an error class is
 * thrown, a message names a command that exists, a port method has a caller, a plugin answer is
 * asked and not read, a test reaches the repository through its helper. Each takes the files as
 * text and returns violations; `kinds.rules.arch.test.ts` holds the tree to them,
 * with no violation tolerated.
 *
 * Written limits: a call is spelled as `.method(` in another file and nothing proves a real path
 * reaches it; an error thrown through a variable (`throw error`) is not seen; a plugin answer held
 * in a variable and read from there is out of sight, which a `#` field prevents.
 */
import {
  isCallExpression,
  isClassDeclaration,
  isIdentifier,
  isInterfaceDeclaration,
  isMethodSignatureDeclaration,
  isNewExpression,
  isNoSubstitutionTemplateLiteral,
  isPropertyAccessExpression,
  isStringLiteral,
  isTemplateExpression,
  isThrowStatement,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { present } from "../shared/testing/present.builder.js";
import { kindsOf, type Rule, type Violation } from "./kinds.js";
import { PROFILE_MODULE_FILE, profileReaders, wholeProfileFlows } from "./profile-flow.js";
import { INTERNAL_IMPORT, resolveImportTarget, unresolvedCommandMentions } from "./source-graph.js";
import { walk, withVirtualProject } from "./ts-project.js";

const violation = (
  rule: Rule,
  entry: string,
  what: string,
  law: string,
  fix: string
): Violation => ({
  rule,
  entry,
  message: `${entry}: ${what}. Rule: ${law} (tests/architecture/kind-rules.ts). Fix: ${fix}.`,
});

/** The syntax tree of each file, read by `read`, which returns what it found in that file. */
function readEach<T>(
  files: Readonly<Record<string, string>>,
  read: (path: string, root: SourceFile) => T[]
): T[] {
  if (Object.keys(files).length === 0) return [];
  return withVirtualProject(
    "kind-rules",
    files,
    { module: "esnext", target: "esnext" },
    (project, at) =>
      Object.keys(files).flatMap((path) => {
        const root = project.program.getSourceFile(at(path));
        if (!root) throw new Error(`the compiler returned no source for ${path}`);
        return read(path, root);
      })
  );
}

const hasModifier = (node: Node, kind: SyntaxKind): boolean =>
  "modifiers" in node &&
  Array.isArray(node.modifiers) &&
  node.modifiers.some((m) => m.kind === kind);

const nameText = (node: Node): string | undefined =>
  isIdentifier(node) ? node.text : isPropertyAccessExpression(node) ? node.name.text : undefined;

/** Every piece of text a string literal or a template holds; a comment is never one. */
function literalsOf(root: SourceFile): string[] {
  const found: string[] = [];
  walk(root, (node) => {
    if (isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)) found.push(node.text);
    else if (isTemplateExpression(node)) {
      found.push(node.head.text, ...node.templateSpans.map((span) => span.literal.text));
    }
  });
  return found;
}

// An error is thrown.

/** The name of each error a file throws: `throw new X` and `reject(new X)`. */
function thrownIn(root: SourceFile): string[] {
  const thrown: string[] = [];
  walk(root, (node) => {
    const raised = isThrowStatement(node)
      ? node.expression
      : isCallExpression(node) && nameText(node.expression) === "reject"
        ? node.arguments[0]
        : undefined;
    if (raised && isNewExpression(raised)) {
      const name = nameText(raised.expression);
      if (name) thrown.push(name);
    }
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

const FIXED_MODULES = ["container", "shared", "tool-profiles"];
const ALLOWED_SUBFOLDERS = ["orchestration"];

/** The root, the shared module and one module per context, and only `orchestration/` as a folder. */
export function compositionViolations(
  files: readonly string[],
  contexts: readonly string[],
  dir = "src/composition"
): Violation[] {
  const inside = files
    .filter((file) => file.startsWith(`${dir}/`))
    .map((f) => f.slice(dir.length + 1));
  const modules = inside.filter((f) => !f.includes("/")).map((f) => f.replace(/\.ts$/, ""));
  const folders = new Set(
    inside.filter((f) => f.includes("/")).map((f) => present(f.split("/")[0]))
  );
  const expected = [...FIXED_MODULES, ...contexts];
  const report = (entry: string, what: string): Violation =>
    violation(
      "composition",
      entry,
      what,
      "composition holds container, shared, the tool registration list and one module per context, and an orchestration folder",
      "add the module of the context, or remove the one no context owns"
    );
  return [
    ...expected
      .filter((name) => !modules.includes(name))
      .map((name) => report(`missing module: ${name}`, `no module wires ${name}`)),
    ...modules
      .filter((name) => !expected.includes(name))
      .map((name) => report(`extra module: ${name}`, `${name} wires no context`)),
    ...[...folders]
      .filter((name) => !ALLOWED_SUBFOLDERS.includes(name))
      .map((name) => report(`unexpected subfolder: ${name}`, `${dir}/${name} is no module`)),
  ];
}

// A port declares nothing nobody calls.

/** "ports" and "contract" must be their own path segment: a substring check also matches
 * `supports/` and `reports/`. A `contract/` file is a port the context offers others. */
export const isPortFile = (path: string): boolean => /(^|\/)(ports|contract)\//.test(path);

/** A method of a port nobody spells as a call, and an optional method, which hides a second port
 * behind a `!== undefined` branch. An adapter implementing a method is not a caller. */
export function portViolations(bodies: ReadonlyMap<string, string>): Violation[] {
  const ports = Object.fromEntries([...bodies].filter(([path]) => isPortFile(path)));
  return readEach(ports, (path, root) =>
    root.statements.filter(isInterfaceDeclaration).flatMap((declaration) =>
      declaration.members.filter(isMethodSignatureDeclaration).flatMap((method) => {
        const name = nameText(method.name);
        if (!name) return [];
        const entry = `${path} :: ${declaration.name.text}.${name}`;
        const out: Violation[] = [];
        if (method.postfixToken?.kind === SyntaxKind.QuestionToken) {
          out.push(
            violation(
              "ports",
              entry,
              "an optional method",
              "a port declares no optional method",
              "split it into a second port the holder asks for"
            )
          );
        }
        const called = [...bodies].some(
          ([file, body]) => file !== path && new RegExp(`\\.${name}\\s*\\(`).test(body)
        );
        if (!called) {
          out.push(
            violation(
              "ports",
              entry,
              "no file spells it as a call",
              "a port declares no method nobody calls",
              "add the caller, or delete the method"
            )
          );
        }
        return out;
      })
    )
  );
}

// A section declares nothing nobody calls. `knip` cannot hold this: its entries include the tests,
// so a method only a test calls reads as used.

const SECTION_FILE = /^src\/contexts\/[^/]+\/domain\/sections\/[^/]+\.ts$/;
const SECTION_CLASS = /^export class (\w+)Section\b[^{]*\{([\s\S]*?)\n\}/gm;
const CLASS_METHOD = /^ {2}(?:(static) )?(?:async )?(?:(get) )?(\w+)\s*(?:<[^>]*>)?\(/gm;

/** The receivers a section is reached through: its key, the key with `Cap` or `Section`, or the
 * generic `cap`, `section` and `capability`, as whole identifiers. */
const namesSection = (receiver: string, key: string): boolean =>
  [key, `${key}cap`, `${key}section`, "cap", "section", "capability"].includes(
    receiver.toLowerCase()
  );

/** A method is called through `this.m(` in its own file, `<receiver>.m(` elsewhere where the
 * receiver names the section or is a call to a `...Section` resolver, a static on the class, a
 * getter without parentheses. */
export function sectionViolations(bodies: ReadonlyMap<string, string>): Violation[] {
  const out: Violation[] = [];
  for (const [file, text] of bodies) {
    if (!SECTION_FILE.test(file)) continue;
    for (const block of text.matchAll(SECTION_CLASS)) {
      const className = `${block[1]}Section`;
      const key = present(block[1]).toLowerCase();
      for (const member of present(block[2]).matchAll(CLASS_METHOD)) {
        const [, isStatic, isGetter, name] = member;
        if (name === "constructor") continue;
        const use = new RegExp(
          `([\\w$]+)(\\([^()]*\\))?\\??\\.${name}${isGetter ? "\\b(?!\\s*\\()" : "\\s*\\("}`,
          "g"
        );
        const called = [...bodies].some(
          ([caller, body]) =>
            body.includes(`.${name}`) &&
            [...body.matchAll(use)].some((match) => {
              const receiver = present(match[1]);
              if (caller === file) return receiver === "this";
              if (isStatic) return receiver === className;
              if (match[2] !== undefined) {
                return (
                  /Section$/.test(receiver) || (receiver === "section" && match[2] === `("${key}")`)
                );
              }
              return namesSection(receiver, key);
            })
        );
        if (!called) {
          out.push(
            violation(
              "sections",
              `${file} :: ${className}.${name}`,
              "no file of src calls it",
              "a section declares no method nobody in src calls",
              "add the caller, or delete the method"
            )
          );
        }
      }
    }
  }
  return out;
}

// A tool's plugin delivery is asked, never read.

const CLASS_BLOCK = /^(?:export )?(?:abstract )?class (\w+)[^{]*\{([\s\S]*?)\n\}/gm;
const PUBLIC_FIELD =
  /^ {2}(?!static |constructor|abstract |override |async |get |set )(?:(?:public|private|protected) )?(?:readonly )?(\w+)[?!]?\s*[:=]/gm;
/** A parameter property cannot be a `#` field, so it is refused outright. */
const PARAMETER_PROPERTY = /constructor\([^)]*\b(?:public|private|protected|readonly)\s+(\w+)/g;
/** What a stored-value answer hands back: a stored field, an optional read of one, a `?? literal`
 * default over it, or a spread copy of it. A call in the expression makes it a computation. */
const STORED = String.raw`(?:this\.#?\w+(?:\??\.\w+)*(?: \?\? [^;()]+)?|\{\s*\.\.\.this\.#?\w+(?:\.\w+)*\s*\})`;
const STORED_VALUE_GETTER = new RegExp(
  String.raw`^ {2}(?:override )?get (\w+)\(\)[^{]*\{\s*return ${STORED};\s*\}`,
  "gm"
);
const STORED_VALUE_METHOD = new RegExp(
  String.raw`^ {2}(?!get |set )(?:override )?(?:public )?(\w+)(?:<[^>]*>)?\([^)]*\)[^{]*\{\s*return ${STORED};\s*\}`,
  "gm"
);
/** A method that returns an object literal built only of stored fields: the declaration handed
 * out whole, field by field. */
const STORED_OBJECT_COPY =
  /^ {2}(?!get |set )(?:override )?(?:public )?(\w+)\([^)]*\)[^{]*\{\s*(?:const (\w+) = this\.#?\w+;\s*)?return \{\s*(?:(?:\.\.\.this\.#?\w+|\w+: (?:this\.#?\w+|\w+)\.\w+),\s*)+\};\s*\}/gm;

/** The files whose classes answer about plugins. */
export const isPluginAnswerFile = (path: string): boolean =>
  /^src\/contexts\/tools\/domain\/(?:sections|native-registration)\/[^/]+\.ts$/.test(path) ||
  path === "src/contexts/tools/domain/profile/plugin-answers.ts";

const ANSWER_FILE = "src/contexts/tools/domain";

/** The stored values a caller needs as they are, because the raw value crosses a file boundary
 * unchanged: a path read, written and hashed, a binary looked up by name, a declaration handed to
 * an adapter. A permanent list, never debt: each entry names its caller and why no method can
 * answer in its place. A question a method can answer is asked, not listed. */
export const STORED_ANSWERS: readonly {
  readonly file: string;
  readonly member: string;
  readonly caller: string;
  readonly reason: string;
}[] = [
  {
    file: `${ANSWER_FILE}/sections/config-section.ts`,
    member: "ConfigSection.outputPath",
    caller: "installation/application/install/config/install-ide-config.ts",
    reason: "the path is checked against the manifest and its basename names the asset to load",
  },
  {
    file: `${ANSWER_FILE}/native-registration/marketplace-registration.ts`,
    member: "MarketplaceRegistration.sharedSettingsFile",
    caller:
      "installation/application/sync/sync-tool-settings-files.ts, installation/application/sync/record-activation.ts",
    reason: "the path is read, written, hashed and matched against the manifest",
  },
  {
    file: `${ANSWER_FILE}/native-registration/native-activation.ts`,
    member: "NativeActivation.hostBinary",
    caller:
      "host-registration/application, installation/application/sync/record-activation.ts, composition/host-registration.ts",
    reason: "the binary is looked up on the PATH and keys the host's activator",
  },
  {
    file: `${ANSWER_FILE}/native-registration/native-activation.ts`,
    member: "NativeActivation.cliShape",
    caller: "composition/host-registration.ts",
    reason: "the host CLI adapter is built from the verbs themselves",
  },
  {
    file: `${ANSWER_FILE}/native-registration/native-activation.ts`,
    member: "NativeActivation.marketplaceSourcesDeclaration",
    caller: "composition/host-registration.ts",
    reason: "the source readers are built from the declaration itself",
  },
];

/** A class of a plugin answer that leaves a stored value readable instead of answering, minus
 * the stored values a caller needs as they are. */
export function answerViolations(files: Readonly<Record<string, string>>): Violation[] {
  const kept = new Set(STORED_ANSWERS.map((a) => `${a.file} :: ${a.member}`));
  return storedValueViolations(files).filter((v) => !kept.has(v.entry));
}

/** Every plugin answer class leaving a stored value readable, kept or not. */
export function storedValueViolations(files: Readonly<Record<string, string>>): Violation[] {
  const out: Violation[] = [];
  for (const [file, source] of Object.entries(files)) {
    if (!isPluginAnswerFile(file)) continue;
    for (const block of source.matchAll(CLASS_BLOCK)) {
      for (const pattern of [
        PUBLIC_FIELD,
        PARAMETER_PROPERTY,
        STORED_VALUE_GETTER,
        STORED_VALUE_METHOD,
        STORED_OBJECT_COPY,
      ]) {
        for (const field of present(block[2]).matchAll(pattern)) {
          out.push(
            violation(
              "answers",
              `${file} :: ${block[1]}.${field[1]}`,
              "leaves a stored value readable",
              "a plugin answer is a method, and its data is a # field",
              "answer by a method and make the field #private"
            )
          );
        }
      }
    }
  }
  return out;
}

// A test reaches the repository through one helper.

const CLIMB = /["'`]((?:\.\.\/)+)[^"'`]*["'`]/g;
const CWD_PARENT = /process\.cwd\(\)\s*,\s*["']\.\.["']/g;
const PACKAGE_PARENT = /\b(?:resolve|join)\(\s*CLI_ROOT\s*,\s*["']\.\.["']/g;
const REPOSITORY_ROOT_BUILDER = "tests/shared/testing/repository-root.builder.ts";
/** The gate's own tests read the checkout as text and plant climbing literals on purpose; test
 * data is never copied. */
const NEVER_COPIED = /^tests\/(?:architecture|fixtures|golden\/snapshots)\//;

/** What a test does to leave `cli/`: a literal with more `../` than its depth, a `process.cwd()`
 * joined to `..`, or the package root joined to `..`. A test that climbs reads the wrong tree the
 * day the package is copied, which a mutation run does. */
export function repositoryViolations(files: Readonly<Record<string, string>>): Violation[] {
  const out: Violation[] = [];
  for (const [file, text] of Object.entries(files)) {
    if (!file.startsWith("tests/") || file === REPOSITORY_ROOT_BUILDER || NEVER_COPIED.test(file))
      continue;
    const depth = file.split("/").length - 1;
    const climbs = [
      ...[...text.matchAll(CLIMB)].filter((m) => present(m[1]).length / 3 > depth).map((m) => m[0]),
      ...text.matchAll(CWD_PARENT).map((m) => m[0]),
      ...text.matchAll(PACKAGE_PARENT).map((m) => m[0]),
    ];
    for (const how of climbs) {
      out.push(
        violation(
          "repository",
          `${file} :: ${how}`,
          "leaves cli/ on its own",
          "a test reaches the repository through tests/shared/testing/repository-root.builder.ts",
          "import REPOSITORY_ROOT from it"
        )
      );
    }
  }
  return out;
}

// translate asks the tool catalog where a host keeps its manifest.

const SOURCE_SPELLING = "src/contexts/translate/domain/canon-format.ts";

/** A string spelling a plugin manifest path in translate, other than the canonical source's: a
 * second spelling of another host's path is a list that drifts from the profiles. */
export function translateViolations(files: Readonly<Record<string, string>>): Violation[] {
  const inTranslate = Object.fromEntries(
    Object.entries(files).filter(
      ([path, text]) =>
        path.startsWith("src/contexts/translate/") &&
        path !== SOURCE_SPELLING &&
        text.includes("plugin.json")
    )
  );
  return readEach(inTranslate, (path, root) =>
    literalsOf(root)
      .filter((text) => text.endsWith("plugin.json"))
      .map((text) =>
        violation(
          "translate",
          `${path} :: "${text}"`,
          "spells a host's plugin manifest path",
          "translate learns a manifest path from the tool catalog, never from a list of its own",
          "ask pluginManifestProbes"
        )
      )
  );
}

// A test file stays small enough to hold in mind.

export const MAX_TEST_LINES = 800;

/** A test file past 800 lines stops being one situation and becomes a pile. Lines as `wc -l`
 * counts them. */
export function sizeViolations(files: Readonly<Record<string, string>>): Violation[] {
  return Object.entries(files)
    .filter(
      ([path, text]) =>
        /\.test\.ts$/.test(path) &&
        !path.startsWith("tests/fixtures/") &&
        text.split("\n").length - 1 > MAX_TEST_LINES
    )
    .map(([path]) =>
      violation(
        "size",
        path,
        `carries more than ${MAX_TEST_LINES} lines`,
        `a test file holds at most ${MAX_TEST_LINES} lines`,
        "split it by situation"
      )
    );
}

const DRIVING_PORT = "src/orchestration/deps.ts";

/** The context imports of the driving port that are not an `import type` of an application or a
 * contract file. */
export function drivingPortViolations(files: Readonly<Record<string, string>>): Violation[] {
  const text = files[DRIVING_PORT];
  if (text === undefined) return [];
  const out: Violation[] = [];
  for (const match of text.matchAll(/^import\s+(type\s+)?[^;]*?from\s+"([^"]+)"/gms)) {
    const specifier = present(match[2]);
    if (!specifier.startsWith("../contexts/")) continue;
    const problem =
      match[1] === undefined
        ? "is a value import"
        : /\/(?:application|contract)\//.test(specifier)
          ? undefined
          : "is neither application nor contract";
    if (problem)
      out.push(
        violation(
          "imports",
          `${DRIVING_PORT} -> ${specifier}`,
          `${specifier} ${problem}`,
          "the driving port names context types only, by import type, from application or contract",
          "import type the application or contract type it needs"
        )
      );
  }
  return out;
}

const contextOfFile = (path: string): string | undefined =>
  /^src\/contexts\/([^/]+)\//.exec(path)?.[1];

/** A `contract/` file nobody outside its context reads. The composition root and the driving port
 * do not count: they wire everything. Such a file is an interior file in the wrong folder, or a
 * surface nobody asked for. */
export function contractReaderViolations(files: Readonly<Record<string, string>>): Violation[] {
  const readFromOutside = new Set<string>();
  for (const [importer, text] of Object.entries(files)) {
    if (importer.startsWith("src/composition/") || importer === DRIVING_PORT) continue;
    for (const match of text.matchAll(INTERNAL_IMPORT)) {
      const target = resolveImportTarget(importer, present(match[1]));
      if (contextOfFile(target) !== contextOfFile(importer)) readFromOutside.add(target);
    }
  }
  return Object.keys(files)
    .filter((path) => /^src\/contexts\/[^/]+\/contract\//.test(path) && !readFromOutside.has(path))
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

/** Where a registration lives, project or user, is `Scope` of `shared/domain/scope.ts`. A credential
 * level names who may use a token, a different notion carrying the same two words. */
const SCOPE_HOMES: readonly string[] = [
  "src/shared/domain/scope.ts",
  "src/contexts/auth/contract/credential.ts",
];

/** The two members side by side, across a line break or not. One with another member between them
 * goes unseen: none exists in the code today. */
const INLINE_UNION = /"project"\s*\|\s*"user"|"user"\s*\|\s*"project"/;

/** A file other than the scope module that spells the project-or-user union inline. A second
 * spelling drifts the day a third scope is added, and the compiler cannot say so. */
export function scopeViolations(files: Readonly<Record<string, string>>): Violation[] {
  return Object.entries(files)
    .filter(([path, text]) => !SCOPE_HOMES.includes(path) && INLINE_UNION.test(text))
    .map(([path]) =>
      violation(
        "scope",
        path,
        'spells the union "project" | "user" inline',
        "the project-or-user union is the Scope type",
        "write Scope from shared/domain/scope.js"
      )
    );
}

const BUILT_IN_COMPOSITION =
  /^src\/(?:orchestration\/|contexts\/[^/]+\/(?:application|infrastructure)\/|shared\/infrastructure\/)/;
const CLASS_DECLARATION = /^export (?:abstract )?class (\w+)/gm;

/** A validating value object the setup command still builds: moving it would reorder the
 * validation errors against the banner. */
const BUILT_IN_PRESENTATION: ReadonlySet<string> = new Set(["SetupFlow"]);

/** A class of an orchestration, an application, an infrastructure or the shared infrastructure
 * that a presentation file or the binary entry builds with `new`. Presentation parses arguments
 * and displays results; `composition/` builds the command or the adapter and hands it in, so a
 * command never decides which adapter backs it. */
export function constructionViolations(files: Readonly<Record<string, string>>): Violation[] {
  const composed = Object.entries(files)
    .filter(([path]) => BUILT_IN_COMPOSITION.test(path))
    .flatMap(([, text]) => [...text.matchAll(CLASS_DECLARATION)].map((match) => present(match[1])))
    .filter((name) => !BUILT_IN_PRESENTATION.has(name));
  return Object.entries(files)
    .filter(([path]) => path.startsWith("src/presentation/") || path === "src/cli.ts")
    .flatMap(([path, text]) =>
      [...new Set(composed)]
        .filter((name) => new RegExp(`\\bnew ${name}\\(`).test(text))
        .sort()
        .map((name) =>
          violation(
            "composition",
            `${path} :: new ${name}`,
            `builds ${name}`,
            "presentation and the binary entry build no command and no adapter",
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
