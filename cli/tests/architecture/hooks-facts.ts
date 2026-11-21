// A tool's hooks facts live in the `declareHooks(` call of its profile alone. Read lexically, with strings and
// comments blanked, because `typescript` 7 ships no in-process parser.

export const PROFILE_FILE = /^src\/contexts\/tools\/domain\/profiles\/[^/]+\/[^/]+\.ts$/;
export const DESCRIPTOR_TYPES = "src/contexts/tools/domain/formats/hooks/descriptor.ts";

const BLANKED = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|(["'`])(?:\\[\s\S]|(?!\1)[^\\])*\1/g;
const REFERENCE_OR_CALL =
  /^(?!(?:true|false|null)\b)(?:new\s+)?[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*\s*(?:\(|,|;|\}|$)/;
const LITERAL = /^(?:["'`[{]|-?\d|(?:true|false)\b|new\s+(?:Map|Set)\(|Object\.freeze\()/;
// A tool with no hooks declares its absence in its profile and its build model: no fact.
const ABSENCE = /^(?:false\b|\{\s*supported:\s*false\b)/;

// A hooks section naming the descriptor's builders by reference, never restating a fact.
const HOOKS_SECTION_OF_REFERENCES = /^\{\s*(?:config:\s*[\w$.()]+|delivery:\s*[\w$.]+)\s*$/;

const HOOKS_PATH = /^["'`][^"'`]*[/.{}"'`]hooks(?:\/|\.json)/;

/** Each member of an interface in the descriptor's type file, true when its type is another of
 * them: a route, which only an object literal restates, so `scopeArgs.project` stays out. */
export function descriptorKeys(types: string): Map<string, boolean> {
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

/** The source with each string and comment blanked to spaces, split into lines. */
function blankedLines(source: string): string[] {
  return source
    .replace(BLANKED, (text, quote?: string) =>
      quote ? quote + text.slice(1, -1).replace(/[^\n]/g, " ") + quote : text.replace(/[^\n]/g, " ")
    )
    .split("\n");
}

const KEY_VALUE = /(?<=^|[{,])\s*(?:readonly\s+)?(\w+)\??\s*:\s*(?=([^,}]*))/g;
const CONSTANT = /^(?:export\s+)?const\s+(\w+)\s*(?::[^=]+)?=\s*(.*)$/;

const opensType = (line: string): boolean => /^\s*(?:export\s+)?(?:type|interface)\b/.test(line);
const braceBalance = (line: string): number => line.split("{").length - line.split("}").length;
const at = (rows: readonly string[], index: number): string => rows[index] ?? "";

// A hook-named key counts only leading its line: Codex's own `features: { hooks: true }`
// is a setting of the tool, not a hooks fact of ours.
function statesFact(
  name: string,
  value: string,
  index: number,
  keys: ReadonlyMap<string, boolean>
): boolean {
  const isRoute = keys.get(name);
  if ((/hook/i.test(name) && index === 0) || isRoute === false)
    return !REFERENCE_OR_CALL.test(value);
  return isRoute === true && value.startsWith("{");
}

/** `config: [...]` is the profile's config section list; the descriptor's own `config`
 * is an object literal and stays a fact. */
const DECLARES_ABSENCE: ReadonlyArray<(name: string, value: string) => boolean> = [
  (name) => name === "hooksUnsupportedReason",
  (name, value) => name === "config" && value.startsWith("["),
  (name, value) => (name === "acceptsHooks" || name === "hooks") && ABSENCE.test(value),
  (name, value) => name === "hooks" && HOOKS_SECTION_OF_REFERENCES.test(value),
];

function keyFacts(line: string, keys: ReadonlyMap<string, boolean>): string[] {
  return [...line.matchAll(KEY_VALUE)]
    .map((match) => ({ name: match[1] ?? "", value: (match[2] ?? "").trim(), index: match.index }))
    .filter(({ name, value, index }) => statesFact(name, value, index, keys))
    .filter(({ name, value }) => !DECLARES_ABSENCE.some((absent) => absent(name, value)))
    .map(({ name }) => name);
}

/** Found on the blanked line, so the text a bridge generates declares nothing; the path is
 * read on the raw line, where the literal still holds it. A value may start on the next line. */
function constantFact(
  index: number,
  lines: readonly string[],
  raw: readonly string[]
): string | undefined {
  const line = at(lines, index);
  const [, name = "", rest = ""] = CONSTANT.exec(line) ?? [];
  if (!name) return undefined;
  const value = rest || at(lines, index + 1).trim();
  const rawValue = rest
    ? at(raw, index).slice(line.length - rest.length)
    : at(raw, index + 1).trim();
  const states = (/hook|event/i.test(name) && LITERAL.test(value)) || HOOKS_PATH.test(rawValue);
  return states ? name : undefined;
}

/** The name of each hooks fact a profile file declares, read outside type declarations. */
export function hooksFacts(source: string, keys: ReadonlyMap<string, boolean>): string[] {
  const raw = source.split("\n");
  const lines = blankedLines(source);
  let typeDepth = 0;
  return lines.flatMap((line, index) => {
    if (typeDepth > 0 || opensType(line)) {
      typeDepth = Math.max(0, typeDepth + braceBalance(line));
      return [];
    }
    const constant = constantFact(index, lines, raw);
    return [
      ...(/\bnew HooksConfigPart\(/.test(line) ? ["HooksConfigPart"] : []),
      ...keyFacts(line, keys),
      ...(constant ? [constant] : []),
    ];
  });
}

const parenDelta = (char: string | undefined): number => (char === "(" ? 1 : char === ")" ? -1 : 0);

/** The index after the parenthesis closing the one at `start`. */
function endOfCall(blank: string, start: number): number {
  let depth = 0;
  let end = start;
  do {
    depth += parenDelta(blank[end]);
    end += 1;
  } while (depth > 0 && end < blank.length);
  return end;
}

/** The source with every `declareHooks(` call blanked: the one place a profile states a fact. */
function withoutDeclaredHooks(source: string): string {
  const blank = source.replace(BLANKED, (text) => text.replace(/[^\n]/g, " "));
  let out = source;
  for (const { 0: opening, index } of blank.matchAll(/\bdeclare(?:Bridge)?Hooks\(/g)) {
    const end = endOfCall(blank, index + opening.length - 1);
    out = out.slice(0, index) + out.slice(index, end).replace(/[^\n]/g, " ") + out.slice(end);
  }
  return out;
}

/** One `<file> (<facts>)` per profile file declaring a fact outside its `declareHooks(` call. */
export function factsOutsideDescriptor(bodies: ReadonlyMap<string, string>): string[] {
  const keys = descriptorKeys(bodies.get(DESCRIPTOR_TYPES) ?? "");
  return [...bodies]
    .filter(([file]) => PROFILE_FILE.test(file))
    .map(([file, body]) => `${file} (${hooksFacts(withoutDeclaredHooks(body), keys).length})`)
    .filter((entry) => !entry.endsWith(" (0)"))
    .sort();
}
