/**
 * The rules of the kind gate about what a file must not spell or exceed: a path that climbs out of
 * `cli/`, a plugin manifest path translate keeps for itself, a test file past the size limit, the
 * project-or-user union written inline. Each takes the files as text and returns violations;
 * `kinds.rules.arch.test.ts` holds the tree to them, with no violation tolerated.
 *
 * Written limit: the union is read when its two members sit side by side.
 */
import { present } from "../shared/testing/present.builder.js";
import { literalsOf, readEach, violation } from "./kind-rule-support.js";
import type { Violation } from "./kinds.js";

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
const HOST_PROFILES = "src/contexts/tools/domain/profiles/";
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
        !path.startsWith(HOST_PROFILES) &&
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
