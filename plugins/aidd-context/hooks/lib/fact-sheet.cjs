"use strict";
/**
 * The fact sheet's grammar and check: `- <id> | <file> > <section> | <fact> | <source> | <answer>`
 * under a Read, Inferred or Unknown block. Node built-ins only.
 */

const fs = require("node:fs");
const path = require("node:path");

const BLOCKS = new Set(["Read", "Inferred", "Unknown"]);
const ID = /^[RDQ]\d+$/u;
const TARGET = /^(?!aidd_docs\/)\S+\.md > \S.*$/u;
const MAX_QUESTIONS = 8;
const MIN_FIELDS = 4;
const MAX_FIELDS = 5;

/** The lines under a block: `{ line, fields }` for a bullet, `{ line, stray }` for one of another shape. */
function factLines(text) {
  const found = [];
  let inBlock = false;
  for (const [index, raw] of text.split(/\r?\n/u).entries()) {
    const heading = raw.match(/^## (.+?)\s*$/u);
    if (heading) inBlock = BLOCKS.has(heading[1]);
    else if (inBlock && raw.startsWith("- ")) found.push({ line: index + 1, fields: raw.slice(2).split("|").map((field) => field.trim()) });
    else if (inBlock && raw.includes("|")) found.push({ line: index + 1, stray: raw.trim() });
  }
  return found;
}

/** Why a line cannot be read, or null. */
function shapeProblem({ fields, stray }) {
  if (stray !== undefined) return `shape: "${stray.slice(0, 40)}" is not a "- " bullet`;
  const [id, target, fact, source] = fields;
  if (fields.length > MAX_FIELDS) return "shape: a `|` in a fact";
  if (fields.length < MIN_FIELDS) return `shape: ${fields.length} fields, expected 4 or 5`;
  if (!ID.test(id)) return `shape: id "${id}" is not R, D or Q and a number`;
  if (!TARGET.test(target)) return `shape: "${target}" is not a bank-relative <file>.md > <section>`;
  if (fact === "" || (source === "" && id[0] !== "Q")) return "shape: the fact and its source are required";
  return null;
}

/** The source as a path, without the backticks a model puts around it. */
const plainSource = (source) => source.replace(/^`+|`+$/gu, "");

/** One message per line that breaks the grammar or cites a source absent from, or outside, the root; empty when the sheet is sound. */
function checkSheet(sheetFile, root) {
  const name = path.basename(sheetFile);
  const lines = factLines(fs.readFileSync(sheetFile, "utf8"));
  if (lines.length === 0) return [`${name}: no fact line under a block`];
  const problems = [];
  const ids = new Set();
  const questions = lines.filter(({ fields }) => fields?.[0]?.[0] === "Q").length;
  if (questions > MAX_QUESTIONS) problems.push(`${name}: ${questions} Q lines, at most eight`);
  for (const entry of lines) {
    const shape = shapeProblem(entry);
    const where = `${name}:${entry.line} ${entry.fields?.[0] ?? "?"}`;
    if (shape !== null) {
      problems.push(`${where} ${shape}`);
      continue;
    }
    if (ids.has(entry.fields[0])) problems.push(`${where} id already used`);
    ids.add(entry.fields[0]);
    const source = plainSource(entry.fields[3]);
    if ((source === "" || source === "none") && entry.fields[0][0] === "Q") continue;
    const relative = path.relative(root, path.resolve(root, source));
    if (path.isAbsolute(source) || relative.startsWith("..")) problems.push(`${where} source outside the root: ${source}`);
    else if (!fs.existsSync(path.resolve(root, source))) problems.push(`${where} source not found: ${source}`);
  }
  return problems;
}

/** The collapsed fact of each `D` line starting `remove` or `replace` whose answer starts with `yes`. */
function approvedRemovals(sheetFile) {
  return factLines(fs.readFileSync(sheetFile, "utf8"))
    .filter(({ fields }) => fields && /^D\d+$/u.test(fields[0]) && /^(?:remove|replace)\b/iu.test(fields[2]) && /^yes\b/iu.test(fields[4] ?? ""))
    .map(({ fields }) => fields[2].trim().replace(/\s+/gu, " "));
}

module.exports = { checkSheet, approvedRemovals, factLines };
