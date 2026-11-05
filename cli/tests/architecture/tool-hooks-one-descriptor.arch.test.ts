/**
 * A tool's hook behaviour is read from one place: `profiles/<tool>/hooks.ts`, its hooks
 * descriptor. Any other file under `profiles/<tool>/` that declares a hooks fact is a second
 * home for it.
 *
 * A hooks fact is one of three declarations, read from code with string, template and comment
 * text blanked, so the source a bridge generates is never read as declarations:
 * - a `new HooksCapability(` construction: destination, merge and section, written in place;
 * - a contract key whose name is a hook-named member of a contract a profile fills
 *   (`HOOK_CONTRACTS`), given a value written in place: anything but a reference (`X`,
 *   `X.y`) or a call, which is read from where it is declared;
 * - a module-level constant whose name says hook or event, given a literal: a string,
 *   template, boolean, number, object, array, `new Map(`, `new Set(` or `Object.freeze(`;
 *   or one of any name whose string literal names a hooks folder or file (`hooks/`,
 *   `hooks.json`), read on the raw text.
 * Logic is not a fact: a function, a local variable and a type declare none. An inline path
 * literal outside these three is not seen.
 */
import { describe, expect, it } from "vitest";
import { expectRatchet, read, sourceFiles } from "./helpers.js";

const PROFILE_FILE = /^src\/contexts\/tools\/domain\/profiles\/([^/]+)\/([^/]+)\.ts$/;
const DESCRIPTOR = "hooks";

/** The contracts a profile fills; their hook-named members are the keys a fact is written in. */
const HOOK_CONTRACTS = [
  "src/contexts/tools/domain/build-contract.ts",
  "src/contexts/tools/domain/capabilities/plugins-capability.ts",
  "src/contexts/tools/domain/contracts.ts",
  "src/contexts/tools/domain/marketplace-catalog.ts",
];

/**
 * Files that declare hooks facts outside their tool's descriptor today, with the count. The
 * list may only shrink, and a file declaring one more fact fails.
 */
const BASELINE: readonly { readonly file: string; readonly facts: number; reason: string }[] = [
  {
    file: "src/contexts/tools/domain/profiles/claude/build.ts",
    facts: 5,
    reason:
      "both build contracts: the hooks artifact twice, `hooksField`, the settings merge and its destination",
  },
  {
    file: "src/contexts/tools/domain/profiles/claude/profile.ts",
    facts: 1,
    reason: "`acceptsHooks`",
  },
  {
    file: "src/contexts/tools/domain/profiles/codex/build.ts",
    facts: 4,
    reason:
      "both build contracts: the hooks artifact twice, the hooks.json merge and its destination",
  },
  {
    file: "src/contexts/tools/domain/profiles/codex/profile.ts",
    facts: 7,
    reason:
      "the hooks config id, trust notice, memory hook command and entries, the HooksCapability and `acceptsHooks`",
  },
  {
    file: "src/contexts/tools/domain/profiles/copilot/build.ts",
    facts: 5,
    reason: "the flat hooks prefix, `hooksField`, the hooks artifact twice and the shape transform",
  },
  {
    file: "src/contexts/tools/domain/profiles/cursor/build.ts",
    facts: 5,
    reason:
      "both build contracts: the hooks artifact twice, `hooksField`, the merge and its destination",
  },
  {
    file: "src/contexts/tools/domain/profiles/cursor/hooks-format.ts",
    facts: 3,
    reason: "the event map, the source hooks prefix and the project hooks script folder",
  },
  {
    file: "src/contexts/tools/domain/profiles/cursor/profile.ts",
    facts: 6,
    reason:
      "`acceptsHooks`, the plugin hooks file, its shape and destination, the project hooks file and shape",
  },
  {
    file: "src/contexts/tools/domain/profiles/kilo/build.ts",
    facts: 3,
    reason: "the flat hooks artifact, the skip of hooks.json and `hooksBridge`",
  },
  {
    file: "src/contexts/tools/domain/profiles/kilo/kilo-paths.ts",
    facts: 1,
    reason: "the hooks folder the flat build writes into",
  },
  {
    file: "src/contexts/tools/domain/profiles/kilo/profile.ts",
    facts: 3,
    reason:
      "`acceptsHooks`, and `flatHooksLoaderEntry` and `flatHooksBridge` restating the bridge `build.ts` declares",
  },
  {
    file: "src/contexts/tools/domain/profiles/opencode/build.ts",
    facts: 2,
    reason: "the skip of hooks.json and `hooksBridge`",
  },
  {
    file: "src/contexts/tools/domain/profiles/opencode/opencode-paths.ts",
    facts: 4,
    reason:
      "the hooks folder, the plugin folder the flat hooks land in, and the bridge events asset and path",
  },
  {
    file: "src/contexts/tools/domain/profiles/opencode/profile.ts",
    facts: 3,
    reason:
      "`acceptsHooks`, and `flatHooksLoaderEntry` and `flatHooksBridge` restating the bridge `build.ts` declares",
  },
];

/** The source with string, template and comment content replaced by spaces, newlines kept,
 * and each literal's delimiters left in place so a value still reads as a literal. */
function codeOnly(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const char = source[i] as string;
    const next = source[i + 1];
    if (char === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") {
        out += " ";
        i += 1;
      }
    } else if (char === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      out += source.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
    } else if (char === '"' || char === "'" || char === "`") {
      out += char;
      i += 1;
      while (i < source.length && source[i] !== char) {
        if (source[i] === "\\") {
          out += "  ";
          i += 2;
          continue;
        }
        out += source[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      out += char;
      i += 1;
    } else {
      out += char;
      i += 1;
    }
  }
  return out;
}

/** Hook-named members of the contracts, as interface members (`name?: T;`). */
function hookContractKeys(bodies: ReadonlyMap<string, string>): Set<string> {
  const keys = new Set<string>();
  for (const file of HOOK_CONTRACTS) {
    for (const match of (bodies.get(file) ?? "").matchAll(
      /^\s+(?:readonly\s+)?(\w*[Hh]ook\w*)\??:[^\n]*;\s*$/gm
    )) {
      keys.add(match[1] as string);
    }
    for (const match of (bodies.get(file) ?? "").matchAll(
      /^\s+(?:readonly\s+)?(\w*[Hh]ook\w*)\??:\s*(?:\(|\{)\s*$/gm
    )) {
      keys.add(match[1] as string);
    }
  }
  return keys;
}

const REFERENCE_OR_CALL =
  /^(?!(?:true|false|null)\b)(?:new\s+)?[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*\s*(?:\(|,|;|\}|$)/;
const LITERAL = /^(?:["'`[{]|-?\d|(?:true|false)\b|new\s+(?:Map|Set)\(|Object\.freeze\()/;
/** A hook or event name, or a string literal naming a hooks folder or file. */
const HOOK_NAME = /hook|event/i;
const HOOKS_PATH = /^["'`][^"'`]*(?:^|[/.{}"'`])hooks(?:\/|\.json)/;

/** One `<line>: <name>` per hooks fact in one profile file. */
function hooksFacts(source: string, keys: ReadonlySet<string>): string[] {
  const facts: string[] = [];
  let typeDepth = 0;
  const raw = source.split("\n");
  codeOnly(source)
    .split("\n")
    .forEach((line, index, lines) => {
      const trimmed = line.trim();
      const opens = (line.match(/\{/g) ?? []).length;
      const closes = (line.match(/\}/g) ?? []).length;
      if (typeDepth > 0 || /^(?:export\s+)?(?:type|interface)\b/.test(trimmed)) {
        typeDepth = Math.max(0, typeDepth + opens - closes);
        return;
      }
      if (/\bnew HooksCapability\(/.test(line)) facts.push(`${index + 1}: new HooksCapability`);
      const key = /^(?:readonly\s+)?(\w+)\??\s*:\s*(.*)$/.exec(trimmed);
      if (key && keys.has(key[1] as string) && !REFERENCE_OR_CALL.test(key[2] as string)) {
        facts.push(`${index + 1}: ${key[1]}`);
      }
      // Found on the blanked line, so a bridge's generated text declares nothing; the path
      // is read on the raw one, where the literal still holds it.
      const constant = /^(?:export\s+)?const\s+(\w+)\s*(?::[^=]+)?=\s*(.*)$/.exec(line);
      if (!constant) return;
      // A value may start on the next line: `const X =` then `"…" + "…";`.
      const value = (constant[2] as string) || (lines[index + 1] ?? "").trim();
      const rawValue = (/=\s*(.*)$/.exec(raw[index] ?? "")?.[1] ?? "").trim();
      const named = HOOK_NAME.test(constant[1] as string) && LITERAL.test(value);
      if (named || HOOKS_PATH.test(rawValue)) facts.push(`${index + 1}: ${constant[1]}`);
    });
  return facts;
}

/** One `<file> (<facts>)` entry per profile file, its tool's descriptor excepted. */
function factsOutsideDescriptor(bodies: ReadonlyMap<string, string>): string[] {
  const keys = hookContractKeys(bodies);
  const found: string[] = [];
  for (const [file, body] of bodies) {
    const profile = PROFILE_FILE.exec(file);
    if (!profile || profile[2] === DESCRIPTOR) continue;
    const facts = hooksFacts(body, keys);
    if (facts.length > 0) found.push(`${file} (${facts.length})`);
  }
  return found.sort();
}

function treeBodies(): Map<string, string> {
  return new Map(sourceFiles().map((file) => [file, read(file)]));
}

describe("a tool's hooks facts live in its descriptor", () => {
  it("no profile file other than hooks.ts declares a hooks fact, beyond the baseline", () => {
    const { added, fixed } = expectRatchet(
      factsOutsideDescriptor(treeBodies()),
      BASELINE.map((entry) => `${entry.file} (${entry.facts})`)
    );

    expect(
      added,
      "a hooks fact declared outside profiles/<tool>/hooks.ts — declare it in the descriptor and read it from there"
    ).toEqual([]);
    expect(fixed, "fixed or changed — update BASELINE").toEqual([]);
  });

  it("reads the hook keys of the contracts, so the rule cannot pass by knowing none", () => {
    const keys = hookContractKeys(treeBodies());

    for (const key of ["hooks", "hooksBridge", "flatHooksBridge", "hooksRelativePath"]) {
      expect(keys.has(key), `${key} — HOOK_CONTRACTS is stale`).toBe(true);
    }
  });

  it("finds the tool profiles, so the rule cannot pass by selecting nothing", () => {
    expect(
      sourceFiles().filter((file) => PROFILE_FILE.test(file)).length,
      "no profile file found — the scope of this rule is stale"
    ).toBeGreaterThan(20);
  });
});

describe("the guard itself", () => {
  const keys = new Set(["hooks", "hooksBridge"]);
  const descriptor = [
    "export const CLAUDE_HOOKS = {",
    '  destination: ".claude/settings.json",',
    "  hooksBridge: { generate: generateBridge },",
    "};",
  ].join("\n");

  it("names the tool whose build declares a second hooks fact outside its descriptor", () => {
    const bodies = new Map([
      ["src/contexts/tools/domain/profiles/claude/hooks.ts", descriptor],
      [
        "src/contexts/tools/domain/profiles/claude/build.ts",
        [
          "export const contract = {",
          "  hooksBridge: CLAUDE_HOOKS.hooksBridge,",
          "  hooks: { supported: true },",
          "};",
        ].join("\n"),
      ],
      [
        "src/contexts/tools/domain/profiles/claude/profile.ts",
        'const CLAUDE_HOOKS_DIR = ".claude/hooks/";\nexport const p = new HooksCapability({ outputPath: CLAUDE_HOOKS_DIR });',
      ],
    ]);
    for (const file of HOOK_CONTRACTS) {
      bodies.set(
        file,
        "export interface C {\n  readonly hooks: ArtifactContract;\n  readonly hooksBridge: Bridge;\n}"
      );
    }

    expect(factsOutsideDescriptor(bodies)).toEqual([
      "src/contexts/tools/domain/profiles/claude/build.ts (1)",
      "src/contexts/tools/domain/profiles/claude/profile.ts (2)",
    ]);
  });

  it("reads a fact in the descriptor, a reference, a call and a local as no fact", () => {
    const source = [
      descriptor,
      "export const c = {",
      "  hooksBridge: CLAUDE_HOOKS.hooksBridge,",
      "  hooks: buildHooksArtifact(),",
      "};",
      "function f(): void {",
      '  const localHooks = { a: "hooks/" };',
      "}",
    ].join("\n");

    expect(hooksFacts(source.replace(descriptor, ""), keys)).toEqual([]);
  });

  it("names an event map built as a Map, Set or frozen object, and a destination by its path", () => {
    const source = [
      'const PLANTED_HOOKS_MAP = new Map([["a", "b"]]);',
      'const PLANTED_EVENT_MAP = new Map(Object.entries({ PostToolUse: "afterFileEdit" }));',
      'export const PLANTED_EVENTS = new Set(["Stop"]);',
      'const PLANTED_HOOK_FIELDS = Object.freeze(["command"]);',
      'const PLANTED_DESTINATION = ".codex/hooks.json";',
      "const PLANTED_DIR = `.cursor/hooks/`;",
      'const UNRELATED = ".codex/config.toml";',
    ].join("\n");

    expect(hooksFacts(source, keys)).toEqual([
      "1: PLANTED_HOOKS_MAP",
      "2: PLANTED_EVENT_MAP",
      "3: PLANTED_EVENTS",
      "4: PLANTED_HOOK_FIELDS",
      "5: PLANTED_DESTINATION",
      "6: PLANTED_DIR",
    ]);
  });

  it("ignores a type, a comment and the text a bridge generates", () => {
    const source = [
      "type Shape = {",
      "  hooks: Array<string>;",
      "};",
      "// hooks: { not: code },",
      "const BRIDGE = `",
      'const HOOKS_DIR = "../hooks/";',
      "  hooks: [1],",
      "`;",
    ].join("\n");

    expect(hooksFacts(source, keys)).toEqual([]);
  });

  it("reads the hook keys a contract declares, members and nested blocks alike", () => {
    const contract = [
      "export interface C {",
      "  readonly hooksMerge?: (",
      "    existing: string",
      "  ) => string;",
      "  readonly skipHooksJson?: boolean;",
      "  readonly hooksBridge?: {",
      "    readonly generate: () => string;",
      "  };",
      "  readonly name: string;",
      "}",
    ].join("\n");

    const bodies = new Map(HOOK_CONTRACTS.map((file) => [file, contract]));

    expect([...hookContractKeys(bodies)].sort()).toEqual([
      "hooksBridge",
      "hooksMerge",
      "skipHooksJson",
    ]);
  });
});
