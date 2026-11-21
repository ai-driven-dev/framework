const FRONTMATTER_DELIMITER = "---";

export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  // A line ends either way: a Windows checkout hands this the same document with CRLF, and
  // the key-only pattern below is `$`-anchored, so a trailing carriage return makes it
  // miss. Splitting on either ending is not the same as stripping every `\r`:
  // one inside a value is content, and stays.
  const lines = content.split(/\r?\n/);

  if (lines[0].trim() !== FRONTMATTER_DELIMITER) {
    return { frontmatter: {}, body: content };
  }

  const closingIndex = lines.slice(1).findIndex((l) => l.trim() === FRONTMATTER_DELIMITER);
  if (closingIndex === -1) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterLines = lines.slice(1, closingIndex + 1);
  const bodyLines = lines.slice(closingIndex + 2);

  const frontmatter = parseYamlLike(frontmatterLines);
  const body = bodyLines.join("\n");

  return { frontmatter, body };
}

function isJsonArray(s: string): boolean {
  if (!s.startsWith("[")) return false;
  try {
    return Array.isArray(JSON.parse(s));
  } catch {
    return false;
  }
}

function serializeListItem(item: unknown): string {
  const s = String(item);
  // Glob patterns (*, ?, {) are syntactically ambiguous in YAML: quote them to prevent misinterpretation.
  return s.includes("*") || s.includes("?") || s.startsWith("{") ? `  - "${s}"` : `  - ${s}`;
}

function serializeScalar(key: string, value: unknown, quote?: "single" | "double"): string {
  if (typeof value === "boolean") return `${key}: ${value}`;
  const s = String(value);
  // JSON-array strings (e.g. from cursor globs) are emitted raw so they stay as YAML inline arrays.
  if (isJsonArray(s)) return `${key}: ${s}`;
  return quote === "double"
    ? `${key}: ${JSON.stringify(s)}`
    : `${key}: '${s.replaceAll("'", "''")}'`;
}

function serializeEntry(key: string, value: unknown, quote?: "single" | "double"): string[] {
  if (Array.isArray(value)) return [`${key}:`, ...value.map(serializeListItem)];
  return [serializeScalar(key, value, quote)];
}

/** `quote: "double"` writes strings as YAML double-quoted scalars, for readers that keep single quotes literally. */
export function serializeFrontmatter(
  frontmatter: Record<string, unknown>,
  body: string,
  quote?: "single" | "double"
): string {
  if (Object.keys(frontmatter).length === 0) {
    return body.replace(/^\n/, "");
  }

  const lines = [
    FRONTMATTER_DELIMITER,
    ...Object.entries(frontmatter).flatMap(([key, value]) => serializeEntry(key, value, quote)),
    FRONTMATTER_DELIMITER,
  ];

  return `${lines.join("\n")}\n${body}`;
}

// `[^\n]` rather than `.` throughout: `.` excludes a carriage return, so a value pattern
// silently misses any line carrying one: and splitting already removed the `\r` of a CRLF
// ending, so what is left is content.
function parseYamlLike(lines: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let i = 0;
  while (i < lines.length) i = readYamlEntry(lines, i, result);
  return result;
}

/** Reads the entry starting at `index` into `result` and returns the index of the next line. */
function readYamlEntry(lines: string[], index: number, result: Record<string, unknown>): number {
  const line = lines[index];
  const keyOnlyMatch = /^(\w[\w-]*):\s*$/.exec(line);
  if (keyOnlyMatch) {
    const { items, next } = collectListBlock(lines, index + 1);
    result[keyOnlyMatch[1]] = items;
    return next;
  }
  const keyValueMatch = /^(\w[\w-]*):\s*([^\n]+)/.exec(line);
  if (!keyValueMatch) return index + 1;
  const rawValue = keyValueMatch[2].trim();
  if (!isBlockScalarIndicator(rawValue)) {
    result[keyValueMatch[1]] = parseScalar(rawValue);
    return index + 1;
  }
  const { value, next } = collectScalarBlock(lines, index + 1, rawValue.startsWith(">"));
  result[keyValueMatch[1]] = value;
  return next;
}

function collectListBlock(lines: string[], start: number): { items: string[]; next: number } {
  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    const match = /^\s{2,}-\s([^\n]+)/.exec(lines[i]);
    if (!match) break;
    items.push(String(parseScalar(match[1].trim())));
    i++;
  }
  return { items, next: i };
}

function collectScalarBlock(
  lines: string[],
  start: number,
  folded: boolean
): { value: string; next: number } {
  const collected: string[] = [];
  let i = start;
  while (i < lines.length && /^\s/.test(lines[i])) {
    collected.push(lines[i].trim());
    i++;
  }
  const value = folded ? collected.join(" ").trimEnd() : collected.join("\n").trimEnd();
  return { value, next: i };
}

function isBlockScalarIndicator(s: string): boolean {
  return s === ">-" || s === ">" || s === "|-" || s === "|";
}

const SCALAR_LITERALS = new Map<string, unknown>([
  ["true", true],
  ["false", false],
  ["null", null],
  ["~", null],
]);

function unquote(value: string): string | undefined {
  if (value.length < 2) return undefined;
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replaceAll('\\"', '"');
  }
  return undefined;
}

function parseScalar(value: string): unknown {
  if (SCALAR_LITERALS.has(value)) return SCALAR_LITERALS.get(value);
  if (isJsonArray(value)) return JSON.parse(value);
  return unquote(value) ?? value;
}
