"use strict";
/**
 * The plan the person reads and the answer that marks the sheet, from one numbering. Items run in
 * a fixed order: a new file (one item for all its lines), lines added to an existing file (one item
 * per file and section), then each `D` line that replaces, moves or removes. A question keeps its
 * sheet id and is never an item. `answer` reads only a closed set of replies and writes only the
 * sheet's answer field: the bank is never written here. Node built-ins only.
 */

const fs = require("node:fs");
const path = require("node:path");
const { factLines } = require("./fact-sheet.cjs");

const MEMORY = path.join("aidd_docs", "memory");
const DECISION = /^(remove|replace|move)\b/iu;
const ORDER = ["write", "add", "change", "delete"];
const SINCE = /^- Since (\S+) \(.*\), (.+?): (\d+ commits?), (\d+ files?) changed$/mu;
const ALL = /^(?:ok|okay|yes|all good|looks good|lgtm)$/u;
const BUT = /^(?:(?:ok|yes)[,\s]+)?(?:not|all but|except)\s+(\d+(?:\s*(?:,|and)\s*\d+)*)$/u;
const CLAUSE = /(?=\btools:|\bQ\d+:)/iu;

const collapse = (line) => line.trim().replace(/\s+/gu, " ");
const unmarked = (line) => line.replace(/^(?:[-*+]|\d+[.)])\s+/u, "");

class ReplyError extends Error {}

/** The project a sheet belongs to: the folder above its `aidd_docs`, else the working folder. */
function rootOf(sheetFile) {
  const parts = path.resolve(sheetFile).split(path.sep);
  const at = parts.lastIndexOf("aidd_docs");
  return at > 0 ? parts.slice(0, at).join(path.sep) || path.sep : process.cwd();
}

function entriesOf(text) {
  return factLines(text)
    .filter(({ fields }) => fields !== undefined)
    .map(({ line, fields }) => {
      const [id, target, fact, source] = fields;
      const [file, section = ""] = target.split(" > ");
      return { line, id, target, file: file.trim(), section: section.trim(), fact, source };
    });
}

/** The bank file's lines, collapsed, or null when the file does not exist yet. */
function bankLines(root, file) {
  try {
    return fs.readFileSync(path.join(root, MEMORY, file), "utf8").split("\n").map(collapse).filter(Boolean);
  } catch {
    return null;
  }
}

/** The whole bank line a fact quotes between double quotes, with or without its list marker; the longest fit, or null. */
function quotedLine(fact, lines) {
  const text = collapse(fact);
  let best = null;
  for (const line of lines ?? []) {
    for (const form of [line, unmarked(line)]) {
      if (form !== "" && text.includes(`"${form}"`) && (best === null || form.length > best.length)) best = form;
    }
  }
  return best;
}

const verbOf = (entry) => (entry.id[0] === "D" ? entry.fact.match(DECISION)?.[1].toLowerCase() : undefined);

/** Every item, numbered from 1 in the fixed order, with the sheet lines behind it. */
function itemsOf(text, root) {
  const items = [];
  const group = (kind, key, entry) => {
    let item = items.find((one) => one.kind === kind && one.key === key);
    if (item === undefined) items.push((item = { kind, key, file: entry.file, section: entry.section, entries: [] }));
    item.entries.push(entry);
  };
  for (const entry of entriesOf(text).filter(({ id }) => id[0] !== "Q")) {
    const verb = verbOf(entry);
    if (verb === "remove") group("delete", entry.id, entry);
    else if (verb !== undefined) group("change", entry.id, entry);
    else if (bankLines(root, entry.file) === null) group("write", entry.file, entry);
    else group("add", `${entry.file} > ${entry.section}`, entry);
  }
  return ORDER.flatMap((kind) => items.filter((item) => item.kind === kind)).map((item, index) => ({ ...item, n: index + 1 }));
}

/** One message per `remove` or `replace` line that quotes no whole line of its bank file. */
function quoteProblems(sheetFile, root) {
  const name = path.basename(sheetFile);
  const problems = [];
  for (const entry of entriesOf(fs.readFileSync(sheetFile, "utf8"))) {
    const verb = verbOf(entry);
    if (verb !== "remove" && verb !== "replace") continue;
    const lines = bankLines(root, entry.file);
    if (quotedLine(entry.fact, lines) !== null) continue;
    const fragment = entry.fact.match(/"([^"]+)"/u)?.[1];
    const whole = fragment === undefined ? undefined : (lines ?? []).find((line) => line.includes(collapse(fragment)));
    const hint = whole === undefined ? "quote one of its lines whole" : `quote "${whole}" whole`;
    problems.push(`${name}:${entry.line} ${entry.id} quotes no whole line of ${entry.file}: ${hint}`);
  }
  return problems;
}

/** What the fact says after the line it quotes, its leading joiner dropped. */
function after(entry, quoted, joiner) {
  const text = collapse(entry.fact);
  return text.slice(text.indexOf(`"${quoted}"`) + quoted.length + 2).replace(joiner, "").trim();
}

function itemLines(item, root) {
  const [first] = item.entries;
  if (item.kind === "write") return [`  ${item.n}. ${item.file}   ${[...new Set(item.entries.map(({ section }) => section))].join(", ")}`];
  if (item.kind === "add") return [`  ${item.n}. ${item.file}, ${item.section}`, ...item.entries.map(({ fact }) => `     + ${fact}`)];
  const quoted = quotedLine(first.fact, bankLines(root, first.file));
  if (quoted === null) return [`  ${item.n}. ${item.file}: ${first.fact}`];
  if (item.kind === "change") return [`  ${item.n}. ${item.file}: "${quoted}"`, `     → ${after(first, quoted, /^[\s:,;]*(?:(?:with|by|into|to)\b|→|->|=>)?\s*/iu)}`];
  return [`  ${item.n}. ${item.file}: "${quoted}"`, `     why: ${after(first, quoted, /^[\s:,;.-]*/u) || first.source}`];
}

const TITLES = { write: "Will write", add: "Will add", change: "Will change", delete: "Will delete" };

/** The plan as the person reads it: plain text, sections in order, an empty one left out. */
function renderPlan(sheetFile, root, tools, ticked) {
  const text = fs.readFileSync(sheetFile, "utf8");
  const items = itemsOf(text, root);
  const questions = entriesOf(text).filter(({ id }) => id[0] === "Q");
  const blocks = [["Memory plan"]];
  const since = text.match(SINCE);
  if (since !== null) blocks.push([`Changes since the last memory update (${since[1]}, ${since[2]}): ${since[3]}, ${since[4]}`]);
  for (const kind of ORDER) {
    const own = items.filter((item) => item.kind === kind);
    if (own.length > 0) blocks.push([TITLES[kind], ...own.flatMap((item) => itemLines(item, root))]);
  }
  if (questions.length > 0) blocks.push(["Questions", ...questions.map(({ id, fact }) => `  ${id}  ${fact}`)]);
  blocks.push(["Tools to wire", `  ${tools.map((tool) => `[${ticked.includes(tool) ? "x" : " "}] ${tool}`).join("  ")}`]);
  const example = [`"not ${Math.max(items.length, 1)}"`, ...(questions.length > 0 ? [`"${questions[0].id}: …"`] : [])].join(" or ");
  blocks.push([`Does this look right? Say ok, or what to change, for example ${example}.`]);
  blocks.push([`Sheet: ${path.relative(root, path.resolve(sheetFile)).split(path.sep).join("/")}`]);
  return `${blocks.map((block) => block.join("\n")).join("\n\n")}\n`;
}

/** The item numbers a reply declines, or a ReplyError when the reply is not one of the closed forms. */
function declined(decision, count) {
  if (ALL.test(decision)) return [];
  if (decision === "no") return Array.from({ length: count }, (_, index) => index + 1);
  const but = decision.match(BUT);
  if (but === null) throw new ReplyError(`"${decision}" is not ok, no, or not <n>: write the answers into the sheet yourself`);
  const numbers = but[1].split(/\s*(?:,|and)\s*/u).map(Number);
  const wrong = numbers.find((number) => number < 1 || number > count);
  if (wrong !== undefined) throw new ReplyError(`no item ${wrong}: the plan has ${count}`);
  return numbers;
}

/** Writes yes or no into every line of every item, per the reply; returns what it printed. Writes nothing on a ReplyError. */
function answerSheet(sheetFile, root, reply) {
  const [head, ...rest] = reply.split(CLAUSE);
  const decision = head.trim().replace(/[.,;!\s]+$/u, "").toLowerCase();
  const clauses = rest.map((clause) => clause.trim().replace(/[.,;\s]+$/u, ""));
  const text = fs.readFileSync(sheetFile, "utf8");
  const items = itemsOf(text, root);
  const no = new Set(declined(decision, items.length));
  const lines = text.split("\n");
  const printed = [];
  for (const item of items) {
    const value = no.has(item.n) ? "no" : "yes";
    for (const { line, id, target, fact, source } of item.entries) lines[line - 1] = `- ${id} | ${target} | ${fact} | ${source} | ${value}`;
    const quoted = item.kind === "change" || item.kind === "delete" ? quotedLine(item.entries[0].fact, bankLines(root, item.file)) : null;
    const label = quoted !== null ? `${item.file} "${quoted}"` : item.kind === "add" ? `${item.file}, ${item.section}` : item.file;
    printed.push(`${item.n} ${value}: ${label}`);
  }
  fs.writeFileSync(sheetFile, lines.join("\n"));
  return [...printed, ...clauses.map((clause) => `left to you: ${clause}`)].join("\n");
}

module.exports = { rootOf, itemsOf, quoteProblems, renderPlan, answerSheet, ReplyError };
