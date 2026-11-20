/**
 * A tool identifier may only appear in that tool's own profile and the registration list.
 * Everywhere else behaviour is read from the profile rather than branched on the name, or a
 * sixth tool means editing N files again. Scope is `src/`: a test naming the tool it tests is
 * not coupling. Comments are stripped first — prose about a tool's layout is documentation.
 */
import { describe, expect, it } from "vitest";
import { present } from "../shared/testing/present.builder.js";
import { expectRatchet, read, sourceFiles } from "./helpers.js";
import { loadDebt } from "./kinds.js";

const DEBT = loadDebt();

/** A debt entry `path: n`, the file with the number it was measured with. */
function counted(entries: readonly string[]): { readonly path: string; readonly named: number }[] {
  return entries.map((entry) => {
    const cut = entry.lastIndexOf(": ");
    return { path: entry.slice(0, cut), named: Number(entry.slice(cut + 2)) };
  });
}

/** The tools, from the tree: a hand-written list leaves the rule blind to the next tool. */
function toolIds(files: readonly string[]): string[] {
  const ids = new Set<string>();
  for (const file of files) {
    const match = /^src\/contexts\/tools\/domain\/profiles\/([^/]+)\//.exec(file);
    if (match) ids.add(present(match[1]));
  }
  return [...ids].sort();
}

/**
 * Files whose job is to wire tools together, so they name them by design. Admitted from the
 * violation scan, but each still held to the number of tools it was written around: a third
 * tool wired into one of them is caught by the count, never exempted by the admission. The list
 * is `toolSites` in `kinds-debt.json`: the one list of measured tools, each source in a folder
 * named for its tool.
 */
const REGISTRATION_SITES = counted(DEBT.toolSites);

/**
 * A measured tool is a few files of readers. A file listed here names its own tool and no other,
 * so a tool is added by new files and one registration, never by an edit to a neighbour. A new
 * file naming a tool is red until written down here; a listed one naming none, until removed.
 * The list is `toolOwn` in `kinds-debt.json`.
 */
const OWN_TOOL_FILES: Readonly<Record<string, string>> = Object.fromEntries(
  DEBT.toolOwn.map((entry): [string, string] => {
    const [file = "", tool = ""] = entry.split(": ");
    return [file, tool];
  })
);

function namesOnlyItsOwnTool(file: string, named: readonly string[]): boolean {
  const own = OWN_TOOL_FILES[file];
  return own !== undefined && named.every((id) => id === own);
}

function isAllowed(file: string, ids: readonly string[]): boolean {
  if (file === "src/composition/tools.ts") return true;
  if (REGISTRATION_SITES.some((site) => site.path === file)) return true;
  return ids.some((id) => file.startsWith(`src/contexts/tools/domain/profiles/${id}/`));
}

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /\/\/[^\n]*/g;

function code(source: string): string {
  return source.replace(BLOCK_COMMENT, "").replace(LINE_COMMENT, "");
}

/**
 * Six forms force an edit: a quoted literal, an object key, a profile's import path, a
 * dotfile directory literal (`".cursor"`, which the exact-match form misses), a file suffix
 * literal (`".cursor.md"`), and a string enumerating two or more tools. A string naming one tool
 * is not a list a sixth must join.
 */
function toolsNamedIn(source: string, ids: readonly string[]): string[] {
  const alternation = ids.join("|");
  const named = new Set<string>();
  const body = code(source);
  const forms = [
    new RegExp(`["'\`](${alternation})["'\`]`, "g"),
    new RegExp(`(?:^|[\\s{,(])(${alternation})\\s*:`, "gm"),
    new RegExp(`["'][^"']*/(${alternation})/[^"']*["']`, "g"),
    new RegExp(`["'\`]\\.(${alternation})["'\`]`, "g"),
    new RegExp(`["'\`]\\.(${alternation})\\.md["'\`]`, "g"),
  ];
  for (const form of forms) {
    for (const match of body.matchAll(form)) named.add(present(match[1]));
  }
  for (const literal of body.matchAll(/(["'`])((?:(?!\1).)*)\1/gs)) {
    const inside = present(literal[2]);
    const listed = ids.filter((id) => new RegExp(`\\b${id}\\b`).test(inside));
    if (listed.length >= 2) for (const id of listed) named.add(id);
  }
  return [...named].sort();
}

/**
 * Files naming a tool outside its profile today, with how many they name; the list may only
 * shrink, and a listed file may not take on another tool. One is not debt:
 * `tool-recommendations.ts`, naming a tool for a reason no profile carries. The rest is host
 * wiring and words shown to a user. `foreign-suffix-filter.ts` is the foreign-file suffix
 * vocabulary, held equal to the registered AI profiles by conformance, and vanishes when the
 * profiles hand each section its own filter. `usage-record.ts` carries the contract's tool
 * vocabulary: `codex` is admitted so a second tool's reader needs no change to the record, and is
 * not a list a new tool joins. The list is `toolNames` in `kinds-debt.json`.
 */
const NAMING_DEBT = counted(DEBT.toolNames);

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

/**
 * Files under `ISOLATED_FROM_TOOLS` still naming a tool in an identifier, with how many
 * distinct identifiers; the list may only shrink, and a listed file may not take on another. The
 * list is `toolIdentifiers` in `kinds-debt.json`.
 */
const IDENTIFIER_DEBT = counted(DEBT.toolIdentifiers);

describe("a tool identifier stays inside its own profile", () => {
  it("no file outside a profile names a tool in a form a new tool would have to join", () => {
    const files = sourceFiles();
    const ids = toolIds(files);
    expect(
      ids.length,
      "no profile directory found — the scope of this rule is stale"
    ).toBeGreaterThan(1);

    const violations = files
      .filter((file) => !isAllowed(file, ids))
      .filter((file) => {
        const named = toolsNamedIn(read(file), ids);
        return named.length > 0 && !namesOnlyItsOwnTool(file, named);
      });

    const { added, fixed } = expectRatchet(
      violations,
      NAMING_DEBT.map((entry) => entry.path)
    );
    expect(added, "tool named outside its profile — read it from the profile instead").toEqual([]);
    expect(fixed, "fixed — remove these from toolNames in kinds-debt.json").toEqual([]);
  });

  it("lists only files that still name their own tool", () => {
    const ids = toolIds(sourceFiles());
    const unneeded = Object.keys(OWN_TOOL_FILES).filter(
      (file) => !toolsNamedIn(read(file), ids).includes(present(OWN_TOOL_FILES[file]))
    );
    expect(unneeded, "names no tool — take it off OWN_TOOL_FILES").toEqual([]);
  });

  it("holds each admitted file to the number of tools its reason was written around", () => {
    const ids = toolIds(sourceFiles());
    const held = [...NAMING_DEBT, ...REGISTRATION_SITES];
    const recorded = held.map(({ path, named }) => `${path}: ${named}`);
    const actual = held.map(({ path }) => `${path}: ${toolsNamedIn(read(path), ids).length}`);

    expect(actual, "an admitted file took on another tool — fix the count and its reason").toEqual(
      recorded
    );
  });
});

describe("the guard itself", () => {
  it("derives the tools from the profiles, so a new one is subject to the rule at once", () => {
    const ids = toolIds(["src/contexts/tools/domain/profiles/frobnicator/profile.ts"]);

    expect(ids, "a directory under profiles/ is a tool").toEqual(["frobnicator"]);
    expect(
      toolsNamedIn('const target = "frobnicator";', ids),
      "and the rule matches it without anyone editing a list"
    ).toEqual(["frobnicator"]);
  });

  it("sees the four forms a quoted-literal match missed, and ignores prose", () => {
    const ids = ["claude", "codex"];

    expect(toolsNamedIn('codex: { "config.toml": x }', ids), "a bare object key").toEqual([
      "codex",
    ]);
    expect(
      toolsNamedIn('import "../../src/contexts/tools/domain/profiles/codex/build.js";', ids),
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

  it("flags a planted dotfile literal outside the baseline the way a real one would be", () => {
    const ids = ["cursor"];
    const file = "src/contexts/framework/application/some-new-helper.ts";
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

    const { added, fixed } = expectRatchet(
      violations,
      IDENTIFIER_DEBT.map((entry) => entry.path)
    );
    expect(
      added,
      "tool-named identifier outside its profile — read it from the capability"
    ).toEqual([]);
    expect(fixed, "fixed — remove these from toolIdentifiers in kinds-debt.json").toEqual([]);
  });

  it("holds each listed file to the identifiers it was measured with", () => {
    const ids = toolIds(sourceFiles());
    const recorded = IDENTIFIER_DEBT.map(({ path, named }) => `${path}: ${named}`);
    const actual = IDENTIFIER_DEBT.map(
      ({ path }) => `${path}: ${toolIdentifiersIn(read(path), ids).length}`
    );

    expect(actual, "a listed file took on another tool-named identifier").toEqual(recorded);
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

// A tool's hooks facts live in `profiles/<tool>/hooks.ts` alone. Read lexically, with strings and
// comments blanked, because `typescript` 7 ships no in-process parser.

const PROFILE_FILE = /^src\/contexts\/tools\/domain\/profiles\/[^/]+\/(?!hooks\.ts$)[^/]+\.ts$/;
const DESCRIPTOR_TYPES = "src/contexts/tools/domain/formats/hooks/descriptor.ts";

const BLANKED = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|(["'`])(?:\\[\s\S]|(?!\1)[^\\])*\1/g;
const REFERENCE_OR_CALL =
  /^(?!(?:true|false|null)\b)(?:new\s+)?[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*\s*(?:\(|,|;|\}|$)/;
const LITERAL = /^(?:["'`[{]|-?\d|(?:true|false)\b|new\s+(?:Map|Set)\(|Object\.freeze\()/;
// A tool with no `hooks.ts` declares its absence in `profile.ts` and `build.ts`: no fact.
const ABSENCE = /^(?:false\b|\{\s*supported:\s*false\b)/;

// A hooks section naming the descriptor's builders by reference, never restating a fact.
const HOOKS_SECTION_OF_REFERENCES = /^\{\s*(?:config:\s*[\w$.()]+|delivery:\s*[\w$.]+)\s*$/;

const HOOKS_PATH = /^["'`][^"'`]*[/.{}"'`]hooks(?:\/|\.json)/;

/** Each member of an interface in the descriptor's type file, true when its type is another of
 * them: a route, which only an object literal restates, so `scopeArgs.project` stays out. */
function descriptorKeys(types: string): Map<string, boolean> {
  const blocks = [...types.matchAll(/^export interface (\w+) \{([\s\S]*?)\n\}/gm)];
  const names = new Set(blocks.map((block) => block[1]));
  const keys = new Map<string, boolean>();
  for (const [, , body = ""] of blocks) {
    for (const [, name = "", type] of body.matchAll(/^\s+(?:readonly\s+)?(\w+)\??:\s*(\w+)?/gm)) {
      keys.set(name, names.has(type));
    }
  }
  return keys;
}

/** The name of each hooks fact a profile file declares, read outside type declarations. */
function hooksFacts(source: string, keys: ReadonlyMap<string, boolean>): string[] {
  const facts: string[] = [];
  const raw = source.split("\n");
  const lines = source
    .replace(BLANKED, (text, quote?: string) =>
      quote ? quote + text.slice(1, -1).replace(/[^\n]/g, " ") + quote : text.replace(/[^\n]/g, " ")
    )
    .split("\n");
  let typeDepth = 0;
  lines.forEach((line, index) => {
    if (typeDepth > 0 || /^\s*(?:export\s+)?(?:type|interface)\b/.test(line)) {
      typeDepth = Math.max(0, typeDepth + line.split("{").length - line.split("}").length);
      return;
    }
    if (/\bnew HooksConfigPart\(/.test(line)) facts.push("HooksConfigPart");
    for (const { 1: name = "", 2: rawValue = "", index } of line.matchAll(
      /(?<=^|[{,])\s*(?:readonly\s+)?(\w+)\??\s*:\s*(?=([^,}]*))/g
    )) {
      const value = rawValue.trim();
      const isRoute = keys.get(name);
      // A hook-named key counts only leading its line: Codex's own `features: { hooks: true }`
      // is a setting of the tool, not a hooks fact of ours.
      const fact =
        (/hook/i.test(name) && index === 0) || isRoute === false
          ? !REFERENCE_OR_CALL.test(value)
          : isRoute === true && value.startsWith("{");
      // `config: [...]` is the profile's config section list; the descriptor's own `config`
      // is an object literal and stays a fact.
      const absent =
        name === "hooksUnsupportedReason" ||
        (name === "config" && value.startsWith("[")) ||
        ((name === "acceptsHooks" || name === "hooks") && ABSENCE.test(value)) ||
        (name === "hooks" && HOOKS_SECTION_OF_REFERENCES.test(value));
      if (fact && !absent) facts.push(name);
    }
    // Found on the blanked line, so the text a bridge generates declares nothing; the path is
    // read on the raw line, where the literal still holds it. A value may start on the next line.
    const [, name = "", rest = ""] =
      /^(?:export\s+)?const\s+(\w+)\s*(?::[^=]+)?=\s*(.*)$/.exec(line) ?? [];
    if (!name) return;
    const value = rest || (lines[index + 1] ?? "").trim();
    const rawValue = rest
      ? (raw[index] ?? "").slice(line.length - rest.length)
      : (raw[index + 1] ?? "").trim();
    if ((/hook|event/i.test(name) && LITERAL.test(value)) || HOOKS_PATH.test(rawValue)) {
      facts.push(name);
    }
  });
  return facts;
}

/** One `<file> (<facts>)` per profile file that is not its tool's descriptor. */
function factsOutsideDescriptor(bodies: ReadonlyMap<string, string>): string[] {
  const keys = descriptorKeys(bodies.get(DESCRIPTOR_TYPES) ?? "");
  return [...bodies]
    .filter(([file]) => PROFILE_FILE.test(file))
    .map(([file, body]) => `${file} (${hooksFacts(body, keys).length})`)
    .filter((entry) => !entry.endsWith(" (0)"))
    .sort();
}

const BUILD = "src/contexts/tools/domain/profiles/claude/build.ts";

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
  it("no profile file other than hooks.ts declares a hooks fact", () => {
    const bodies = new Map(sourceFiles().map((file) => [file, read(file)]));
    const keys = descriptorKeys(read(DESCRIPTOR_TYPES));

    expect(
      factsOutsideDescriptor(bodies),
      "a hooks fact declared outside profiles/<tool>/hooks.ts — declare it in the descriptor and read it from there"
    ).toEqual([]);
    expect(sourceFiles().filter((file) => PROFILE_FILE.test(file)).length).toBeGreaterThan(20);
    expect(
      ["scriptsDir", "pluginFile", "eventMap", "flat", "project"].map((key) => keys.get(key)),
      "DESCRIPTOR_TYPES is stale"
    ).toEqual([false, false, false, true, true]);
  });

  it("names the file, and reads no fact in the tool's own hooks.ts", () => {
    const fact = "export const p = new HooksConfigPart({});";
    const bodies = new Map([
      [BUILD, fact],
      [BUILD.replace("build.ts", "hooks.ts"), fact],
    ]);

    expect(factsOutsideDescriptor(bodies)).toEqual([`${BUILD} (1)`]);
  });

  it.each(PLANTED)("reads %s", (row) => {
    const [source = "", facts = ""] = row.split(" →");

    expect(hooksFacts(source, descriptorKeys(read(DESCRIPTOR_TYPES)))).toEqual(
      facts.split(" ").filter(Boolean)
    );
  });
});
