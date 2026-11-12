/**
 * aidd-context's reader of markdown structure: `markdownLines` and `proseLines` are the one reader
 * of fences, comments, front matter and code. The hook and the project-memory skill ship apart, so
 * each holds this file, byte for byte the same.
 */

const QUOTE_PREFIX = /^(?:\s{0,3}>)+\s?/u;
const FENCE_OPENER = /^(`{3,}|~{3,})(.*)$/u;
const FENCE_CLOSER = /^(`{3,}|~{3,})\s*$/u;
const INDENTED = /^(?: {4}|\t)/u;
const LIST_ITEM_START = /^\s*(?:[-*+]|\d+[.)])\s/u;
const FRONT_MATTER_FENCE = /^---\s*$/u;
const HARD_BREAK = /(?: {2,}|\\)$/u;

/** Whether a line opens a fence: its marker, or null. A backtick fence's info string holds no backtick. */
function fenceOpener(line) {
  const match = FENCE_OPENER.exec(line);
  if (match === null || (match[1][0] === "`" && match[2].includes("`"))) return null;
  return match[1];
}

/** The line without its HTML comments, and whether a comment is still open at its end. */
function withoutComments(line, open) {
  let kept = "";
  let rest = line;
  let inside = open;
  for (;;) {
    const at = rest.indexOf(inside ? "-->" : "<!--");
    if (at === -1) return { text: inside ? kept : kept + rest, open: inside };
    if (!inside) kept += rest.slice(0, at);
    rest = rest.slice(at + (inside ? 3 : 4));
    inside = !inside;
  }
}

/** The line index where a front matter ends (the closing `---`), or -1 when the text has none. */
function frontMatterEnd(lines) {
  if (!FRONT_MATTER_FENCE.test(lines[0] ?? "")) return -1;
  return lines.findIndex((line, index) => index > 0 && FRONT_MATTER_FENCE.test(line));
}

/**
 * The one reader of markdown structure: every line with the place it stands in, so each rule and
 * the sync read fences, comments and code the same way. `kind` is `front` (front matter), `fence`
 * (a code or diagram fence, backtick or tilde, nested, quoted or indented, delimiters included),
 * `comment` (a line holding only HTML comment), `code` (a four-space indented block outside a
 * list) or `text`. `text` is the trimmed line without its comments, `source` the line as written,
 * and `hardBreak` tells a line ending in two spaces or a backslash.
 */
function markdownLines(content) {
  const lines = content.split("\n").map((line) => line.replace(/\r$/u, ""));
  const frontEnd = frontMatterEnd(lines);
  const result = [];
  let fence = null;
  let comment = false;
  let list = false;
  let previousFlat = true;

  for (const [index, source] of lines.entries()) {
    const entry = { number: index + 1, source, text: "", kind: "text", hardBreak: HARD_BREAK.test(source) };
    result.push(entry);
    if (index <= frontEnd) {
      entry.kind = "front";
      continue;
    }
    const unquoted = source.replace(QUOTE_PREFIX, "").trim();
    if (fence !== null) {
      entry.kind = "fence";
      const closer = FENCE_CLOSER.exec(unquoted);
      if (closer && closer[1][0] === fence[0] && closer[1].length >= fence.length) fence = null;
      continue;
    }
    const stripped = withoutComments(source, comment);
    const startedInComment = comment;
    comment = stripped.open;
    entry.text = stripped.text.trim();
    if (!startedInComment) {
      fence = fenceOpener(unquoted);
      if (fence !== null) {
        entry.kind = "fence";
        entry.text = "";
        continue;
      }
    }
    if (entry.text === "" && source.trim() !== "") {
      entry.kind = "comment";
      continue;
    }
    if (entry.text === "") {
      previousFlat = true;
      continue;
    }
    if (INDENTED.test(source) && previousFlat && !list) {
      entry.kind = "code";
      entry.text = "";
      continue;
    }
    if (LIST_ITEM_START.test(source)) list = true;
    else if (!/^\s/u.test(source)) list = false;
    previousFlat = false;
  }

  return result;
}

/** Each line that is prose or a list, table, heading or quote: not front matter, a fence, a comment or code. */
function proseLines(source) {
  return markdownLines(source).filter(({ kind, text }) => kind === "text" && text !== "");
}

module.exports = { markdownLines, proseLines };
