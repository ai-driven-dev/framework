"use strict";
// Markdown reading helpers. No rules here: only views of a file that rules query.
const fs = require("node:fs");

const FENCE = /^\s*(```|~~~)/u;
const INLINE_CODE = /`[^`\n]*`/gu;
const COMMENT = /<!--[\s\S]*?--!?>/gu;
const HEADING = /^(#{1,6})\s+(.+?)\s*$/u;

/** File text with CRLF read as LF. */
function readText(file) {
  return fs.readFileSync(file, "utf8").replace(/\r\n?/gu, "\n");
}

/** Frontmatter fields, the line of each field, and how many lines the block spans. */
function frontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n/u.exec(text);
  if (!match) return { fields: {}, fieldLine: {}, span: 0 };
  const fields = {};
  const fieldLine = {};
  match[1].split("\n").forEach((line, index) => {
    const field = /^([\w-]+):\s*(.*)$/u.exec(line);
    if (field && !(field[1] in fields)) {
      fields[field[1]] = field[2].replace(/^(["'])(.*)\1$/u, "$2");
      fieldLine[field[1]] = index + 2;
    }
  });
  return { fields, fieldLine, span: match[0].split("\n").length - 1 };
}

/** Per line: true when the line sits in a fenced block (opening fence included). */
function fenceMask(text) {
  let fenced = false;
  return text.split("\n").map((line) => {
    if (FENCE.test(line)) fenced = !fenced;
    return fenced;
  });
}

/** Each line with fences, comments and inline code blanked, so prose rules skip them. */
function proseLines(text) {
  const lines = text.replace(COMMENT, (m) => m.replace(/[^\n]/gu, " ")).split("\n");
  let fenced = false;
  return lines.map((line) => {
    if (FENCE.test(line)) {
      fenced = !fenced;
      return "";
    }
    return fenced ? "" : line.replace(INLINE_CODE, "``");
  });
}

/** Headings found in prose, with level, name and 1-based line. */
function headings(prose) {
  const found = [];
  prose.forEach((line, index) => {
    const match = HEADING.exec(line);
    if (match) found.push({ level: match[1].length, name: match[2], line: index + 1 });
  });
  return found;
}

/** Per line: the name of the enclosing level-2 section, or null. */
function sectionOf(prose) {
  let current = null;
  return prose.map((line) => {
    const match = /^##\s+(.+?)\s*$/u.exec(line);
    if (match) current = match[1];
    return current;
  });
}

module.exports = { readText, frontmatter, fenceMask, proseLines, headings, sectionOf, COMMENT };
