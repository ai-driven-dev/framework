// Reads a UI record: flat front matter, `## ` sections, and a section's first table.

const LINE_BREAK = "\n";
const SECTION_PREFIX = "## ";
const TABLE_CELL_SEPARATOR = "|";

const ENTRY = /^([a-z][a-z0-9-]*):[ \t]*(.*)$/;
const LIST = /^\[(.*)\]$/;
const QUOTED = /^(["'])(.*)\1$/;
const TABLE_SEPARATOR_ROW = /^\|[\s:|-]+\|$/;

const NO_FRONT_MATTER = "no front matter, open and close it with a --- line";

/** A value without the one pair of quotes around it, if any. */
const unquote = (value) => value.match(QUOTED)?.[2] ?? value;

/** A front matter value: `[a, b]` as a list, anything else as trimmed text, quotes dropped. */
function parseValue(raw) {
  const list = raw.trim().match(LIST);
  if (!list) return unquote(raw.trim());
  return list[1]
    .split(",")
    .map((item) => unquote(item.trim()))
    .filter(Boolean);
}

const isFence = (line) => line.trimEnd() === "---";

/** Front matter between the first two `---` lines, with one problem per line that is neither
 * `key: value` nor `key: [a, b]`. Lines are numbered as in the file. */
function parseFrontMatter(lines) {
  const close = lines.findIndex((line, index) => index > 0 && isFence(line));
  if (!isFence(lines[0]) || close < 0) return { found: false, values: {}, end: 0, problems: [{ line: 1, message: NO_FRONT_MATTER }] };
  const values = {};
  const problems = [];
  for (let index = 1; index < close; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    const entry = line.match(ENTRY);
    if (entry) values[entry[1]] = parseValue(entry[2]);
    else problems.push({ line: index + 1, message: `expected "key: value" or "key: [a, b]", got "${line.trim()}"` });
  }
  return { found: true, values, end: close + 1, problems };
}

/** The body's `## ` sections by name, each with its first line number and its lines. */
function parseSections(lines, start) {
  const sections = {};
  let current;
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith(SECTION_PREFIX)) {
      current = { line: index + 1, lines: [] };
      sections[line.slice(SECTION_PREFIX.length).trim()] = current;
    } else if (current) current.lines.push(line);
  }
  return sections;
}

const cells = (line) => line.split(TABLE_CELL_SEPARATOR).slice(1, -1).map((cell) => cell.trim());

/** The section's first table as rows keyed by its header; [] when it has none. */
function table(section) {
  if (!section) return [];
  const start = section.lines.findIndex((line) => line.trim().startsWith(TABLE_CELL_SEPARATOR));
  if (start < 0) return [];
  const block = [];
  for (const line of section.lines.slice(start)) {
    if (!line.trim().startsWith(TABLE_CELL_SEPARATOR)) break;
    block.push(line.trim());
  }
  const header = cells(block[0]);
  return block
    .slice(1)
    .filter((line) => !TABLE_SEPARATOR_ROW.test(line))
    .map((line) => Object.fromEntries(cells(line).map((cell, index) => [header[index], cell])));
}

/** A record's front matter, its problems, and its sections. */
function parseRecord(text) {
  const lines = text.split(LINE_BREAK);
  const frontMatter = parseFrontMatter(lines);
  return {
    hasFrontMatter: frontMatter.found,
    frontMatter: frontMatter.values,
    problems: frontMatter.problems,
    sections: parseSections(lines, frontMatter.end),
  };
}

/** A front matter value as a list: a lone value is a list of one, an absent or empty one is empty. */
function list(value) {
  if (value === undefined || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

module.exports = { parseRecord, table, list };
