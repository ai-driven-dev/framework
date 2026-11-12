/**
 * A tool's hooks facts live in `profiles/<tool>/hooks.ts` alone. Read lexically, with strings and
 * comments blanked, because `typescript` 7 ships no in-process parser.
 */
import { describe, expect, it } from "vitest";
import { read, sourceFiles } from "./helpers.js";

const PROFILE_FILE = /^src\/contexts\/tools\/domain\/profiles\/[^/]+\/(?!hooks\.ts$)[^/]+\.ts$/;
const DESCRIPTOR_TYPES = "src/contexts/tools/domain/formats/hooks-descriptor.ts";

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
