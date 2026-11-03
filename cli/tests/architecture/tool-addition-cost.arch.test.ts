/**
 * A tool identifier may only appear in that tool's own profile and in the shared vocabulary.
 * Everywhere else behaviour is read from the profile rather than branched on the name, or a
 * sixth tool means editing N files again. Scope is `src/`: a test naming the tool it tests is
 * not coupling. Comments are stripped first — prose about a tool's layout is documentation.
 */
import { describe, expect, it } from "vitest";
import { expectRatchet, read, sourceFiles } from "./helpers.js";

/** The tools, from the tree: a hand-written list leaves the rule blind to the next tool. */
function toolIds(files: readonly string[]): string[] {
  const ids = new Set<string>();
  for (const file of files) {
    const match = /^src\/contexts\/tools\/domain\/profiles\/([^/]+)\//.exec(file);
    if (match) ids.add(match[1] as string);
  }
  return [...ids].sort();
}

function isAllowed(file: string, ids: readonly string[]): boolean {
  if (file === "src/kernel/tool.ts") return true;
  return ids.some((id) => file.startsWith(`src/contexts/tools/domain/profiles/${id}/`));
}

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /\/\/[^\n]*/g;

function code(source: string): string {
  return source.replace(BLOCK_COMMENT, "").replace(LINE_COMMENT, "");
}

/**
 * Five forms force an edit: a quoted literal, an object key, a profile's import path, a
 * dotfile directory literal (`".cursor"`, which the exact-match form misses), and a string
 * enumerating two or more tools. A string naming one tool is not a list a sixth must join.
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
  ];
  for (const form of forms) {
    for (const match of body.matchAll(form)) named.add(match[1] as string);
  }
  for (const literal of body.matchAll(/(["'`])((?:(?!\1).)*)\1/gs)) {
    const inside = literal[2] as string;
    const listed = ids.filter((id) => new RegExp(`\\b${id}\\b`).test(inside));
    if (listed.length >= 2) for (const id of listed) named.add(id);
  }
  return [...named].sort();
}

/**
 * Files naming a tool outside its profile today, with how many they name; the list may only
 * shrink, and a listed file may not take on another tool. Three are not debt:
 * `tool-recommendations.ts`, `config-refs.ts` and `plugins-capability.ts`, each naming a tool
 * for a reason no profile carries. The rest is registration and words shown to a user.
 */
const BASELINE: readonly { readonly path: string; readonly named: number }[] = [
  { path: "src/contexts/framework/domain/tool-recommendations.ts", named: 4 },
  { path: "src/contexts/tools/domain/capabilities/config-refs.ts", named: 1 },
  { path: "src/contexts/tools/domain/capabilities/plugins-capability.ts", named: 3 },
  { path: "src/presentation/commands/setup.ts", named: 2 },
  { path: "src/presentation/commands/translate.ts", named: 6 },
  { path: "src/presentation/prompts/menu-use-case.ts", named: 7 },
  { path: "src/runtime/assets/asset-loader.ts", named: 7 },
  { path: "src/runtime/wiring/framework.ts", named: 7 },
  { path: "src/runtime/wiring/tools.ts", named: 7 },
  { path: "src/runtime/wiring/translate.ts", named: 7 },
  // Which file each host keeps its plugin registry in, called from the composition root
  // alone; the reader classes beside it name no tool.
  {
    path: "src/contexts/tools/infrastructure/host-plugin-registry-reader-adapter.ts",
    named: 3,
  },
  // The record's tool vocabulary is the contract's: `codex` is admitted so a second tool's
  // reader needs no change to the record, and is not a list a new tool joins.
  { path: "src/contexts/telemetry/domain/usage-record.ts", named: 1 },
  // Where Claude Code keeps its transcripts, named for the one tool whose directory it is.
  { path: "src/contexts/telemetry/domain/claude-projects-root.ts", named: 1 },
  // Codex's own session-file format and where Codex keeps those files, each named for the one
  // tool whose files it reads: a tool measured is its reader, not a list a new tool joins.
  { path: "src/contexts/telemetry/domain/formats/codex-transcript-usage.ts", named: 1 },
  {
    path: "src/contexts/telemetry/infrastructure/transcripts/codex-transcript-source-adapter.ts",
    named: 1,
  },
  // Claude Code's own settings files, read to say how long it keeps a transcript.
  { path: "src/contexts/telemetry/infrastructure/switch/claude-settings-adapter.ts", named: 1 },
];

const STRING_LITERAL = /(["'`])(?:(?!\1)[^\\\n]|\\.)*\1/g;
const IDENTIFIER = /[A-Za-z_$][A-Za-z0-9_$]*/g;
const ISOLATED_FROM_TOOLS = /^src\/contexts\/[^/]+\/(?:application\/|domain\/formats\/)/;

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
 * Files under `application/` or `domain/formats/` still naming a tool in an identifier, with
 * how many distinct identifiers; the list may only shrink, and a listed file may not take on
 * another.
 */
const IDENTIFIER_BASELINE: readonly { readonly path: string; readonly named: number }[] = [
  { path: "src/contexts/distribution/application/fetch-marketplace-source-use-case.ts", named: 1 },
  { path: "src/contexts/distribution/application/marketplace-refresh-use-case.ts", named: 1 },
  { path: "src/contexts/framework/application/clean/clean-user-scope-use-case.ts", named: 1 },
  {
    path: "src/contexts/framework/application/framework/translator/flat-mcp-materializer.ts",
    named: 1,
  },
  {
    path: "src/contexts/framework/application/framework/translator/mode-b-flat-materialization-translator.ts",
    named: 1,
  },
  {
    path: "src/contexts/framework/application/install/install-runtime-config-use-case.ts",
    named: 1,
  },
  { path: "src/contexts/framework/application/ownership/project-plugin-cleanup.ts", named: 1 },
  { path: "src/contexts/framework/application/plugin/plugin-remove-use-case.ts", named: 1 },
  { path: "src/contexts/framework/application/restore/restore-use-case.ts", named: 4 },
  { path: "src/contexts/telemetry/application/switch/telemetry-on-use-case.ts", named: 2 },
  { path: "src/contexts/telemetry/domain/formats/claude-transcript-usage.ts", named: 2 },
  { path: "src/contexts/telemetry/domain/formats/codex-transcript-usage.ts", named: 2 },
  { path: "src/contexts/tools/domain/formats/agent-frontmatter-strip.ts", named: 4 },
  { path: "src/contexts/tools/domain/formats/opencode-mcp-merge.ts", named: 4 },
  { path: "src/contexts/tools/domain/formats/plugin-root-token.ts", named: 2 },
  { path: "src/contexts/tools/domain/formats/vscode-mcp-merge.ts", named: 1 },
  { path: "src/contexts/translate/application/strategies/flat-build-strategy.ts", named: 3 },
  { path: "src/contexts/translate/domain/formats/cursor-hooks.ts", named: 7 },
  { path: "src/contexts/translate/domain/formats/plugin-root-token-rewrite.ts", named: 1 },
];

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
      .filter((file) => toolsNamedIn(read(file), ids).length > 0);

    const { added, fixed } = expectRatchet(
      violations,
      BASELINE.map((entry) => entry.path)
    );
    expect(added, "tool named outside its profile — read it from the profile instead").toEqual([]);
    expect(fixed, "fixed — remove these from BASELINE").toEqual([]);
  });

  it("holds each admitted file to the number of tools its reason was written around", () => {
    const ids = toolIds(sourceFiles());
    const recorded = BASELINE.map(({ path, named }) => `${path}: ${named}`);
    const actual = BASELINE.map(({ path }) => `${path}: ${toolsNamedIn(read(path), ids).length}`);

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

describe("a tool never names an identifier in application or format code", () => {
  const scoped = () => sourceFiles().filter((file) => ISOLATED_FROM_TOOLS.test(file));

  it("no application or format file declares or imports an identifier carrying a tool name", () => {
    const ids = toolIds(sourceFiles());
    const violations = scoped().filter((file) => toolIdentifiersIn(read(file), ids).length > 0);

    const { added, fixed } = expectRatchet(
      violations,
      IDENTIFIER_BASELINE.map((entry) => entry.path)
    );
    expect(
      added,
      "tool-named identifier outside its profile — read it from the capability"
    ).toEqual([]);
    expect(fixed, "fixed — remove these from IDENTIFIER_BASELINE").toEqual([]);
  });

  it("holds each listed file to the identifiers it was measured with", () => {
    const ids = toolIds(sourceFiles());
    const recorded = IDENTIFIER_BASELINE.map(({ path, named }) => `${path}: ${named}`);
    const actual = IDENTIFIER_BASELINE.map(
      ({ path }) => `${path}: ${toolIdentifiersIn(read(path), ids).length}`
    );

    expect(actual, "a listed file took on another tool-named identifier").toEqual(recorded);
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
