/**
 * The rules of the kind gate about what a file must not spell or exceed: a path that climbs out of
 * `cli/`, a plugin manifest path translate keeps for itself, a test file past the size limit, the
 * project-or-user union written inline. Each takes the files as text and returns violations;
 * `kinds.rules.arch.test.ts` holds the tree to them, with no violation tolerated.
 *
 * Written limits: the union is read when its two members sit side by side; a cache is seen when it
 * is a module-level `let` or a module-level `Map`/`Set` a method call mutates, not an object literal
 * assigned to.
 */
import {
  isCallExpression,
  isIdentifier,
  isNewExpression,
  isPropertyAccessExpression,
  isVariableStatement,
  type Node,
  NodeFlags,
  type SourceFile,
} from "typescript/unstable/ast";
import { present } from "../shared/testing/present.builder.js";
import { literalsOf, readEach, violation } from "./kind-rule-support.js";
import { kindsOf, type Violation } from "./kinds.js";
import { walk } from "./ts-project.js";

// A test reaches the repository through the repository-root builder.

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

// A host's plugin manifest path has one spelling outside the host's own profile: the canon's.

const SOURCE_SPELLING = "src/shared/domain/plugin/canon-paths.ts";
const HOST_PROFILES = ["src/composition/tool-profiles/", "src/contexts/tools/domain/behaviours/"];
const HOST_PLUGIN_DIR = /\.(claude|cursor|codex)-plugin\b/;
const MANIFEST_PATH = /^\S*plugin\.json$/;

/** A string spelling a host's plugin directory or manifest path, outside the canonical source and
 * the profiles that own a host's spelling: a second one is a copy that drifts from the profiles. */
export function manifestSpellingViolations(files: Readonly<Record<string, string>>): Violation[] {
  const outsideTheOwners = Object.fromEntries(
    Object.entries(files).filter(
      ([path, text]) =>
        path.startsWith("src/") &&
        path !== SOURCE_SPELLING &&
        !HOST_PROFILES.some((owner) => path.startsWith(owner)) &&
        (text.includes("plugin.json") || HOST_PLUGIN_DIR.test(text))
    )
  );
  return readEach(outsideTheOwners, (path, root) =>
    literalsOf(root)
      .filter((text) => MANIFEST_PATH.test(text) || HOST_PLUGIN_DIR.test(text))
      .map((text) =>
        violation(
          "manifestSpelling",
          `${path} :: "${text}"`,
          "spells a host's plugin manifest path",
          "a manifest path comes from the canon's constants or from the tool catalog, never from a literal of its own",
          "import it from shared/domain/plugin/canon-paths.ts or ask pluginManifestProbes"
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

// A command the binary names is spoken by presentation alone.

/** `aidd` and the word after it: a command the CLI declares or a placeholder, never the prose
 * word that follows the name ("not an aidd command"). */
const BINARY_NAMED = /\baidd ([a-z][a-z-]*|<)/g;

/** A string or template outside presentation that names the binary: a layer below presentation
 * returns a code and its facts, and presentation words the command a person is told to run. */
export function binaryViolations(
  files: Readonly<Record<string, string>>,
  declared: ReadonlySet<string>
): Violation[] {
  const below = Object.fromEntries(
    Object.entries(files).filter(
      ([path, text]) => !path.startsWith("src/presentation/") && text.includes("aidd ")
    )
  );
  return readEach(below, (path, root) =>
    literalsOf(root)
      .filter((text) =>
        [...text.matchAll(BINARY_NAMED)].some(([, word]) => word === "<" || declared.has(word))
      )
      .map((text) =>
        violation(
          "binary",
          `${path} :: ${JSON.stringify(text)}`,
          "names the binary outside presentation",
          "a command a person is told to run is worded by presentation, from a code and its facts",
          "return the code and its facts, and word the command in src/presentation"
        )
      )
  );
}

// The domain holds no clock, no logging and no memo.

const DOMAIN_KINDS = ["model", "profile"];
const CLOCK_CALLS: readonly string[] = [
  "Date.now",
  "performance.now",
  "process.hrtime",
  "process.hrtime.bigint",
];
const MEMO_CONTAINERS: readonly string[] = ["Map", "Set", "WeakMap", "WeakSet"];
const MEMO_WRITES: readonly string[] = ["set", "add", "delete", "clear"];

/** `a.b.c` as text when every link is a plain name, else nothing. */
function dotted(node: Node): string | undefined {
  if (isIdentifier(node)) return node.text;
  if (!isPropertyAccessExpression(node)) return undefined;
  const owner = dotted(node.expression);
  return owner && `${owner}.${node.name.text}`;
}

/** The module-level bindings of a file, each with whether it is a `const` and what it is built by. */
function moduleBindings(root: SourceFile) {
  return root.statements.filter(isVariableStatement).flatMap((statement) =>
    statement.declarationList.declarations.flatMap(({ name, initializer }) =>
      isIdentifier(name)
        ? [
            {
              name: name.text,
              isConst: (statement.declarationList.flags & NodeFlags.Const) !== 0,
              type:
                initializer && isNewExpression(initializer)
                  ? dotted(initializer.expression)
                  : undefined,
            },
          ]
        : []
    )
  );
}

/** The module-level `let`s of a file, and its `Map`s and `Set`s by name. */
function moduleState(root: SourceFile): { lets: string[]; containers: Map<string, string> } {
  const bindings = moduleBindings(root);
  return {
    lets: bindings.filter((b) => !b.isConst).map((b) => b.name),
    containers: new Map(
      bindings.flatMap((b) =>
        b.isConst && b.type && MEMO_CONTAINERS.includes(b.type) ? [[b.name, b.type] as const] : []
      )
    ),
  };
}

/** What a node reads from the clock or the console: `new Date()` with no argument, a clock call, a
 * `console.` call. */
function worldRead(node: Node): string | undefined {
  if (isNewExpression(node)) {
    return dotted(node.expression) === "Date" && !node.arguments?.length ? "new Date()" : undefined;
  }
  const callee = isCallExpression(node) ? dotted(node.expression) : undefined;
  return callee && (CLOCK_CALLS.includes(callee) || callee.startsWith("console."))
    ? `${callee}()`
    : undefined;
}

/** The name a `name.set(...)`-like call writes to, if the node is one. */
function writtenName(node: Node): string | undefined {
  const callee = isCallExpression(node) ? dotted(node.expression) : undefined;
  const [owner, method, ...rest] = callee?.split(".") ?? [];
  return owner && method && rest.length === 0 && MEMO_WRITES.includes(method) ? owner : undefined;
}

/** The clock and `console.` calls of a file, and the module-level names a method call writes. */
function calls(root: SourceFile): { impure: string[]; written: Set<string> } {
  const impure: string[] = [];
  const written = new Set<string>();
  walk(root, (node) => {
    const read = worldRead(node);
    if (read) impure.push(read);
    const name = writtenName(node);
    if (name) written.add(name);
  });
  return { impure, written };
}

/** What a domain file reads from the world or keeps between calls: the clock, `console.`, a
 * module-level `let` and a module-level `Map` or `Set` that a method call writes. A string that
 * spells them (a script the domain generates) is text, never a call. */
function impurities(root: SourceFile): string[] {
  const { lets, containers } = moduleState(root);
  const { impure, written } = calls(root);
  return [
    ...impure,
    ...lets.map((name) => `module-level let ${name}`),
    ...[...containers]
      .filter(([name]) => written.has(name))
      .map(([name, type]) => `module-level ${type} ${name} written`),
  ];
}

/** A file of the domain kind that reads a clock, logs, or keeps a cache between calls. The domain
 * stays a function of its arguments: time comes in through the clock port, a message goes out as a
 * returned fact, and a memo lives in the layer that owns the lifetime. */
export function purityViolations(files: Readonly<Record<string, string>>): Violation[] {
  const domain = Object.fromEntries(
    Object.entries(files).filter(([path]) =>
      kindsOf(path).some((kind) => DOMAIN_KINDS.includes(kind))
    )
  );
  return readEach(domain, (path, root) =>
    impurities(root).map((what) =>
      violation(
        "purity",
        `${path} :: ${what}`,
        "is not pure",
        "the domain holds no clock, no logging and no memo",
        "take time from the clock port, return a fact instead of logging, and keep a cache in application or infrastructure"
      )
    )
  );
}

/** The tools context holds no adapter: what touches the world for a tool lives in shared
 * infrastructure, and a profile holds the instance as data. */
export function toolsAdapterViolations(files: Readonly<Record<string, string>>): Violation[] {
  return Object.keys(files)
    .filter(
      (path) =>
        path.startsWith("src/contexts/tools/") &&
        (path.includes("/infrastructure/") || path.endsWith(".adapter.ts"))
    )
    .map((path) =>
      violation(
        "toolsAdapter",
        path,
        "is an adapter held by the tools context",
        "the tools context holds no adapter",
        "move it to src/shared/infrastructure and hand the instance to the profile as data"
      )
    );
}

const ASSET_IMPORT =
  /^\s*(?:import|export)\b[^"';]*?\bfrom\s*["']([^"']+\.(?:cjs|txt|json|md))["']/gm;

/** A file of a domain folder that imports a raw asset (a script, a text, a json): the domain
 * receives that text from composition, through a port or as data. */
export function domainAssetViolations(files: Readonly<Record<string, string>>): Violation[] {
  return Object.entries(files)
    .filter(([path]) => /^src\/(?:contexts\/[^/]+|shared)\/domain\//.test(path))
    .flatMap(([path, text]) =>
      [...text.matchAll(ASSET_IMPORT)].map((match) =>
        violation(
          "domainAsset",
          `${path} :: ${match[1]}`,
          "imports a raw asset",
          "a domain imports no raw asset",
          "import it in composition and hand the text in as a parameter or through a port"
        )
      )
    );
}
