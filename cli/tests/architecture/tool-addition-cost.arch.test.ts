/**
 * Adding a tool costs one profile file in `composition/tool-profiles/` and one line in the
 * registration list beside it. A tool identifier may appear only there and in the tool's own
 * behaviour folder; everywhere else behaviour is read from the profile rather than branched on the
 * name, or the next tool means editing N files again. Scope is `src/`: a test naming the tool it
 * tests is not coupling. Comments are stripped first - prose about a tool's layout is documentation.
 */
import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES } from "../../src/composition/tool-profiles/index.js";
import { present } from "../shared/testing/present.builder.js";
import {
  DESCRIPTOR_TYPES,
  descriptorKeys,
  factsOutsideDescriptor,
  hooksFacts,
  PROFILE_FILE,
} from "./hooks-facts.js";
import { read, sourceFiles } from "./source-graph.js";

const PROFILES = "src/composition/tool-profiles/";
const REGISTRATION = `${PROFILES}index.ts`;
const BEHAVIOURS = "src/contexts/tools/domain/behaviours/";

/** The tools, from the profile files: a hand-written list leaves the rule blind to the next tool. */
function toolIds(files: readonly string[]): string[] {
  const ids = new Set<string>();
  for (const file of files) {
    const match = /^src\/composition\/tool-profiles\/([^/]+)\.ts$/.exec(file);
    if (match && file !== REGISTRATION) ids.add(present(match[1]));
  }
  return [...ids].sort();
}

/** The profile files the list does not register, then the ids it registers with no file. */
function registrationGaps(ids: readonly string[], registered: readonly string[]): string[] {
  return [
    ...ids.filter((id) => !registered.includes(id)).map((id) => `unregistered: ${id}`),
    ...registered.filter((id) => !ids.includes(id)).map((id) => `no profile file: ${id}`),
  ];
}

/**
 * `usage-record.ts` is the one permanent exemption: `USAGE_TOOLS` is the vocabulary of tools
 * stored in a user's ledger, kept by telemetry apart from `tools` so that a reader of one tool
 * needs no edit to the record. It names `codex` once and is held to that count; a new tool's
 * reader adds a value to it, which is the stored data changing, not a branch on the name.
 */
const STORED_VOCABULARY = { path: "src/contexts/telemetry/contract/usage-record.ts", named: 1 };

/** A folder named for one tool, a behaviour or a telemetry source, names that tool alone. */
const OWN_FOLDERS = [BEHAVIOURS, "src/contexts/telemetry/infrastructure/sources/"];

function isAllowed(file: string, ids: readonly string[], named: readonly string[] = []): boolean {
  if (file === REGISTRATION || file === STORED_VOCABULARY.path) return true;
  return ids.some(
    (id) =>
      file === `${PROFILES}${id}.ts` ||
      (OWN_FOLDERS.some((folder) => file.startsWith(`${folder}${id}/`)) &&
        named.every((name) => name === id))
  );
}

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /\/\/[^\n]*/g;

function code(source: string): string {
  return source.replace(BLOCK_COMMENT, "").replace(LINE_COMMENT, "");
}

/** Composition registers a measured tool once, by importing its adapter from its own folder. */
const SOURCE_IMPORT_PATH = /(["'])[^"']*\/telemetry\/infrastructure\/sources\/[^"']*\1/g;

/**
 * Six forms force an edit: a quoted literal, an object key, a profile's import path, a
 * dotfile directory literal (`".cursor"`, which the exact-match form misses), a file suffix
 * literal (`".cursor.md"`), and a string enumerating two or more tools. A string naming one tool
 * is not a list a sixth must join.
 */
function namedByForms(body: string, ids: readonly string[]): string[] {
  const alternation = ids.join("|");
  const forms = [
    new RegExp(`["'\`](${alternation})["'\`]`, "g"),
    new RegExp(`(?:^|[\\s{,(])(${alternation})\\s*:`, "gm"),
    new RegExp(`["'][^"']*/(${alternation})/[^"']*["']`, "g"),
    new RegExp(`["'\`]\\.(${alternation})["'\`]`, "g"),
    new RegExp(`["'\`]\\.(${alternation})\\.md["'\`]`, "g"),
  ];
  return forms.flatMap((form) => [...body.matchAll(form)].map((match) => present(match[1])));
}

/** A string naming two or more tools is a list a sixth must join. */
function namedByEnumeration(body: string, ids: readonly string[]): string[] {
  return [...body.matchAll(/(["'`])((?:(?!\1).)*)\1/gs)].flatMap((literal) => {
    const inside = present(literal[2]);
    const listed = ids.filter((id) => new RegExp(`\\b${id}\\b`).test(inside));
    return listed.length >= 2 ? listed : [];
  });
}

function toolsNamedIn(source: string, ids: readonly string[]): string[] {
  const body = code(source).replace(SOURCE_IMPORT_PATH, '""');
  return [...new Set([...namedByForms(body, ids), ...namedByEnumeration(body, ids)])].sort();
}

const STRING_LITERAL = /(["'`])(?:(?!\1)[^\\\n]|\\.)*\1/g;
const IDENTIFIER = /[A-Za-z_$][A-Za-z0-9_$]*/g;
const ISOLATED_FROM_TOOLS =
  /^src\/(?:orchestration\/|contexts\/(?:[^/]+\/(?:application\/|domain\/formats\/)|tools\/domain\/(?:(?:sections|hooks|bridges|native-registration|profile)\/|profile\.ts$|marketplace-(?:catalog|entry)\.ts$)|tools\/contract\/))/;

function words(identifier: string): string[] {
  return identifier
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_$]+/)
    .map((word) => word.toLowerCase())
    .filter((word) => word !== "");
}

/**
 * Identifiers a file declares or imports that carry a tool's name as one of their words
 * (`mergeCursorX`, `ClaudeHooksShape`): a function named after a tool is a branch a sixth tool
 * must join. Strings and comments are removed first, so prose and messages never count.
 */
function toolIdentifiersIn(source: string, ids: readonly string[]): string[] {
  const body = code(source).replace(STRING_LITERAL, '""');
  const named = new Set<string>();
  for (const match of body.matchAll(IDENTIFIER)) {
    if (words(match[0]).some((word) => ids.includes(word))) named.add(match[0]);
  }
  return [...named].sort();
}

describe("a tool identifier stays inside its own profile", () => {
  it("registers every profile file once, and no tool without one", () => {
    const registered = REGISTERED_PROFILES.map((profile) => profile.toolId);

    expect(
      registrationGaps(toolIds(sourceFiles()), registered),
      "a profile file and the registration list disagree - add the line, or the file"
    ).toEqual([]);
  });

  it("no file outside a profile names a tool in a form a new tool would have to join", () => {
    const files = sourceFiles();
    const ids = toolIds(files);
    expect(
      ids.length,
      "no profile directory found - the scope of this rule is stale"
    ).toBeGreaterThan(1);

    const violations = files.filter((file) => {
      const named = toolsNamedIn(read(file), ids);
      return named.length > 0 && !isAllowed(file, ids, named);
    });

    expect(violations, "tool named outside its profile - read it from the profile instead").toEqual(
      []
    );
  });

  it("holds the admitted file to the number of tools its reason was written around", () => {
    const ids = toolIds(sourceFiles());
    const { path, named } = STORED_VOCABULARY;

    expect(
      toolsNamedIn(read(path), ids).length,
      "the admitted file took on another tool - fix the count and its reason"
    ).toBe(named);
  });
});

describe("the guard itself", () => {
  it("derives the tools from the profile files, so a new one is subject to the rule at once", () => {
    const ids = toolIds([`${PROFILES}frobnicator.ts`, REGISTRATION]);

    expect(ids, "a profile file is a tool, the registration list is none").toEqual(["frobnicator"]);
    expect(
      toolsNamedIn('const target = "frobnicator";', ids),
      "and the rule matches it without anyone editing a list"
    ).toEqual(["frobnicator"]);
  });

  it("reports a profile file the list does not register, and a line with no file", () => {
    expect(registrationGaps(["claude", "frobnicator"], ["claude"])).toEqual([
      "unregistered: frobnicator",
    ]);
    expect(registrationGaps(["claude"], ["claude", "frobnicator"])).toEqual([
      "no profile file: frobnicator",
    ]);
  });

  it("admits a tool's own profile and behaviour folder, never a shared format or a neighbour", () => {
    const ids = ["claude", "codex"];

    expect(isAllowed(`${PROFILES}codex.ts`, ids, ["codex", "claude"]), "its profile").toBe(true);
    expect(isAllowed(`${BEHAVIOURS}codex/codex-build.model.ts`, ids, ["codex"])).toBe(true);
    expect(
      isAllowed(`${BEHAVIOURS}codex/codex-build.model.ts`, ids, ["claude"]),
      "a neighbour named in a behaviour folder"
    ).toBe(false);
    expect(
      isAllowed("src/contexts/tools/domain/formats/command.ts", ids, ["codex"]),
      "a shared format"
    ).toBe(false);
  });

  it("sees the four forms a quoted-literal match missed, and ignores prose", () => {
    const ids = ["claude", "codex"];

    expect(toolsNamedIn('codex: { "config.toml": x }', ids), "a bare object key").toEqual([
      "codex",
    ]);
    expect(
      toolsNamedIn(
        'import "../../src/contexts/tools/domain/behaviours/codex/codex-build.model.js";',
        ids
      ),
      "an import path"
    ).toEqual(["codex"]);
    expect(
      toolsNamedIn('"Conversion target (claude, codex)"', ids),
      "an enumeration inside one string"
    ).toEqual(["claude", "codex"]);
    expect(toolsNamedIn("// claude lays its files out differently", ids), "a comment").toEqual([]);
    expect(
      toolsNamedIn('throw new Error("claude is not installed")', ids),
      "one tool named"
    ).toEqual([]);
    expect(
      toolsNamedIn('join(root, ".cursor", "hooks.json")', ["cursor"]),
      "a dotfile directory literal"
    ).toEqual(["cursor"]);
  });

  it("admits a telemetry source naming only its own tool, and no other file there", () => {
    const ids = ["claude", "codex"];
    const own = "src/contexts/telemetry/infrastructure/sources/codex/codex-session-roots.ts";

    expect(isAllowed(own, ids, ["codex"]), "its own tool").toBe(true);
    expect(isAllowed(own, ids, ["claude", "codex"]), "a neighbour's too").toBe(false);
    expect(
      isAllowed("src/contexts/telemetry/infrastructure/sources/transcript-files.ts", ids, [
        "codex",
      ]),
      "outside any tool's folder"
    ).toBe(false);
  });

  it("lets composition register a telemetry source by its import, and nothing else of the tool", () => {
    const ids = ["claude", "codex"];
    const path = "../contexts/telemetry/infrastructure/sources/codex/codex-session-roots.js";

    expect(toolsNamedIn(`import { roots } from "${path}";`, ids), "the registration").toEqual([]);
    expect(toolsNamedIn(`roots("codex");`, ids), "a literal beside it").toEqual(["codex"]);
  });

  it("flags a planted dotfile literal outside the baseline the way a real one would be", () => {
    const ids = ["cursor"];
    const file = "src/contexts/framework/application/some-new-module.ts";
    const content = 'const hooksPath = join(projectRoot, ".cursor", "hooks.json");';

    expect(isAllowed(file, ids), "the planted file is not inside cursor's own profile").toBe(false);
    expect(
      toolsNamedIn(content, ids),
      "the same literal project-hooks-materializer.ts and plugin-remove-use-case.ts carried"
    ).toEqual(["cursor"]);
  });
});

describe("a tool never names an identifier outside its profile, in the code every tool shares", () => {
  const scoped = () => sourceFiles().filter((file) => ISOLATED_FROM_TOOLS.test(file));

  it("no shared file declares or imports an identifier carrying a tool name", () => {
    const ids = toolIds(sourceFiles());
    const violations = scoped().filter((file) => toolIdentifiersIn(read(file), ids).length > 0);

    expect(
      violations,
      "tool-named identifier outside its profile - read it from the capability"
    ).toEqual([]);
  });

  it("scopes the scenarios of src/orchestration", () => {
    expect(ISOLATED_FROM_TOOLS.test("src/orchestration/setup/setup.ts")).toBe(true);
  });

  it("sees a tool as one word of a camelCase, PascalCase or upper-case identifier", () => {
    const ids = ["claude", "cursor"];

    expect(toolIdentifiersIn("export function mergeCursorX() {}", ids)).toEqual(["mergeCursorX"]);
    expect(toolIdentifiersIn("import type { ClaudeHooksShape } from './x.js';", ids)).toEqual([
      "ClaudeHooksShape",
    ]);
    expect(toolIdentifiersIn("const CLAUDE_ROOT = 1;", ids)).toEqual(["CLAUDE_ROOT"]);
    expect(toolIdentifiersIn("const cursorless = 1; const claudette = 2;", ids)).toEqual([]);
    expect(
      toolIdentifiersIn('// mergeCursorX\nthrow new Error("Cursor is missing");', ids),
      "a comment and a message"
    ).toEqual([]);
  });
});

const PROFILE = `${PROFILES}claude.ts`;

/** A planted profile source, then ` → ` and the facts it declares, which none must be. */
const PLANTED = [
  "const p = new HooksConfigPart({ a: X }); → HooksConfigPart",
  "const c = {\n  hooks: { supported: true },\n  hooksBridge: true,\n}; → hooks hooksBridge",
  'const HOOK_TIMEOUT = 30;\nconst EVENT_ON = false;\nconst HOOK_FIELDS = ["a"]; → HOOK_TIMEOUT EVENT_ON HOOK_FIELDS',
  'const HOOK_NAME =\n  "a" + "b"; → HOOK_NAME',
  'const A_HOOKS = new Map([["a", "b"]]);\nexport const EVENTS = new Set(["Stop"]); → A_HOOKS EVENTS',
  'const HOOK_F = Object.freeze(["c"]); → HOOK_F',
  'const DEST = ".codex/hooks.json";\nconst DIR = `.cursor/hooks/`; → DEST DIR',
  'const NEXT =\n  ".codex/hooks.json"; → NEXT',
  'const i = { hooks: flatHooksArtifact({ scriptsDir: ".c/hooks/", sharedFile: ".c/s.json" }) }; → scriptsDir sharedFile',
  'const b = { project: { sharedFile: ".cursor/hooks.json" } }; → project sharedFile',
  'const d = { rootToken: "ROOT", eventMap: { Stop: ["stop"] } }; → rootToken eventMap',
  'const s = {\n  hooksBridge: { ...C.hooksBridge },\n  x: f({ ...C.flat, scriptsDir: ".x/" }),\n}; → hooksBridge scriptsDir',
  "const c = {\n  hooksBridge: C.hooksBridge,\n  hooks: build(),\n  flat: f(C.flat, {}),\n  hooksMerge,\n  x: { ...C.flat },\n}; →",
  'function f(): void {\n  const localHooks = { a: "hooks/" };\n} →',
  'const a = { scopeArgs: { project: ["--scope", "local"] }, features: { hooks: true } }; →',
  'const U = ".codex/config.toml"; →',
  "const s = {\n  config: [new ConfigSection({ a: X })],\n}; →",
  "const s = {\n  hooks: { config: part(D), delivery: d.delivery },\n}; →",
  "const c = {\n  config: { outputPath: X },\n}; → config",
  'const p = {\n  acceptsHooks: false,\n  hooksUnsupportedReason: "runs no plugin hooks",\n}; →',
  "const c = {\n  hooks: { supported: true },\n  acceptsHooks: true,\n}; → hooks acceptsHooks",
  "const c = {\n  hooks: { delivery: { kind: X } },\n}; → hooks",
  "const c = {\n  skills: { supported: true },\n  hooks: { supported: false },\n}; →",
  'type Shape = {\n  hooks: Array<string>;\n};\n// hooks: { not: code },\nconst BRIDGE = `\nconst HOOKS_DIR = "../hooks/";\n  hooks: [1],\n`; →',
];

describe("a tool's hooks facts live in its descriptor", () => {
  it("no profile file declares a hooks fact outside its declareHooks call", () => {
    const bodies = new Map(sourceFiles().map((file) => [file, read(file)]));
    const keys = descriptorKeys(read(DESCRIPTOR_TYPES));

    expect(
      factsOutsideDescriptor(bodies),
      "a hooks fact declared outside the profile's declareHooks call - declare it in the descriptor and read it from there"
    ).toEqual([]);
    expect(sourceFiles().filter((file) => PROFILE_FILE.test(file)).length).toBeGreaterThan(20);
    expect(
      ["scriptsDir", "pluginFile", "eventMap", "flat", "project"].map((key) => keys.get(key)),
      "DESCRIPTOR_TYPES is stale"
    ).toEqual([false, false, false, true, true]);
  });

  it("names the file, and reads no fact inside the profile's own declareHooks call", () => {
    const fact = "new HooksConfigPart({})";
    const inside = `const hooks = declareHooks(owner, {\n  rootToken: "R",\n  events: { Stop: "stop(" },\n  x: ${fact},\n});`;
    const bodies = new Map([[PROFILE, `${inside}\nconst p = ${fact};`]]);

    expect(factsOutsideDescriptor(bodies)).toEqual([`${PROFILE} (1)`]);
    expect(factsOutsideDescriptor(new Map([[PROFILE, inside]]))).toEqual([]);
  });

  it.each(PLANTED)("reads %s", (row) => {
    const [source = "", facts = ""] = row.split(" →");

    expect(hooksFacts(source, descriptorKeys(read(DESCRIPTOR_TYPES)))).toEqual(
      facts.split(" ").filter(Boolean)
    );
  });
});
