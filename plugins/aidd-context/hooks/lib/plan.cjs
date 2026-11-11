"use strict";
/**
 * The plan the person reads and the answer that marks the sheet, from one numbering. Writes only
 * the sheet. Node built-ins only.
 */

const fs = require("node:fs");
const path = require("node:path");
const { factLines } = require("./fact-sheet.cjs");
const { collapse, unmarked } = require("./bank-guard.cjs");

const MEMORY = path.join("aidd_docs", "memory");
const DECISION = /^(remove|replace|move)\b/iu;
const ORDER = ["write", "add", "change", "delete"];
const SINCE = /^- Since (\S+) \(.*\), (.+?): (\d+ commits?), (\d+ files?) changed$/mu;
const ALL = /^(?:ok|okay|yes|all good|looks good|lgtm)$/u;
const NUMBER = String.raw`\d+(?:\s*[-–]\s*\d+)?`;
const BUT = new RegExp(String.raw`^(?:(?:ok|yes)[,\s]+)?(?:not|all but|except)\s+(${NUMBER}(?:\s*(?:,|and)\s*${NUMBER})*)$`, "u");
const SHORT = 60;
const CLAUSE = /(?=\btools:|\bQ\d+:)/iu;

class ReplyError extends Error {}

/** The folder above the sheet's `aidd_docs`, else the working folder. */
function rootOf(sheetFile) {
  const parts = path.resolve(sheetFile).split(path.sep);
  const at = parts.lastIndexOf("aidd_docs");
  return at > 0 ? parts.slice(0, at).join(path.sep) || path.sep : process.cwd();
}

function entriesOf(text) {
  return factLines(text)
    .filter(({ fields }) => fields !== undefined)
    .map(({ line, fields }) => {
      const [id, target, fact, source, answer = ""] = fields;
      const [file, section = ""] = target.split(" > ");
      return { line, id, target, file: file.trim(), section: section.trim(), fact, source, answer };
    });
}

const linesOf = (text) => text.split("\n").map(collapse).filter(Boolean);

const diskBank = (root) => (file) => {
  try {
    return linesOf(fs.readFileSync(path.join(root, MEMORY, file), "utf8"));
  } catch {
    return null;
  }
};

/** The longest whole bank line the fact quotes, list marker optional, or null. */
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

/** Numbered from 1: new files, additions, changes, deletions. A `Q` line is never an item. */
function itemsOf(text, bank) {
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
    else if (bank(entry.file) === null) group("write", entry.file, entry);
    else group("add", `${entry.file} > ${entry.section}`, entry);
  }
  return ORDER.flatMap((kind) => items.filter((item) => item.kind === kind)).map((item, index) => ({ ...item, n: index + 1 }));
}

function quoteProblems(sheetFile, root) {
  const name = path.basename(sheetFile);
  const problems = [];
  for (const entry of entriesOf(fs.readFileSync(sheetFile, "utf8"))) {
    const verb = verbOf(entry);
    if (verb !== "remove" && verb !== "replace") continue;
    const lines = diskBank(root)(entry.file);
    if (quotedLine(entry.fact, lines) !== null) continue;
    const fragment = entry.fact.match(/"([^"]+)"/u)?.[1];
    const whole = fragment === undefined ? undefined : (lines ?? []).find((line) => line.includes(collapse(fragment)));
    const hint = whole === undefined ? "quote one of its lines whole" : `quote "${whole}" whole`;
    problems.push(`${name}:${entry.line} ${entry.id} quotes no whole line of ${entry.file}: ${hint}`);
  }
  return problems;
}

function after(entry, quoted, joiner) {
  const text = collapse(entry.fact);
  return text.slice(text.indexOf(`"${quoted}"`) + quoted.length + 2).replace(joiner, "").trim();
}

function itemLines(item, bank) {
  const [first] = item.entries;
  if (item.kind === "write") return [`  ${item.n}. ${item.file}   ${[...new Set(item.entries.map(({ section }) => section))].join(", ")}`];
  if (item.kind === "add") return [`  ${item.n}. ${item.file}, ${item.section}`, ...item.entries.map(({ fact }) => `     + ${fact}`)];
  const quoted = quotedLine(first.fact, bank(first.file));
  if (quoted === null) return [`  ${item.n}. ${item.file}: ${first.fact}`];
  if (item.kind === "change") return [`  ${item.n}. ${item.file}: "${quoted}"`, `     → ${after(first, quoted, /^[\s:,;]*(?:(?:with|by|into|to)\b|→|->|=>)?\s*/iu)}`];
  return [`  ${item.n}. ${item.file}: "${quoted}"`, `     why: ${after(first, quoted, /^[\s:,;.-]*/u) || first.source}`];
}

const TITLES = { write: "Will write", add: "Will add", change: "Will change", delete: "Will delete" };

const cut = (text) => (text.length > SHORT ? `${text.slice(0, SHORT - 1).trimEnd()}…` : text);

/** The item's verb as the person reads it. */
function shownVerb(item) {
  if (item.kind === "change") return item.entries[0].fact.match(DECISION)?.[1].toLowerCase() === "move" ? "move" : "change";
  return item.kind === "delete" ? "remove" : item.kind;
}

/** One line per item: its number, its verb, and what it touches, cut short. */
function summaryLine(item, bank, width) {
  const [first] = item.entries;
  const head = `  ${`${item.n}.`.padEnd(width + 1)} ${shownVerb(item).padEnd(7)} `;
  const moved = first.fact.match(/^move\s+(\S+)\s+to\s+(\S+)/iu);
  if (moved !== null) return `${head}${moved[1]} → ${moved[2]}`;
  if (item.kind === "write") return `${head}${item.file} (new): ${[...new Set(item.entries.map(({ section }) => section))].join(", ")}`;
  if (item.kind === "add") return `${head}${item.file}, ${item.section}: ${cut(first.fact)}${item.entries.length > 1 ? ` (+${item.entries.length - 1})` : ""}`;
  const quoted = quotedLine(first.fact, bank(first.file));
  return `${head}${item.file}: ${quoted === null ? cut(first.fact) : `"${cut(quoted)}"`}`;
}

/** Where the quoted line sits in its bank file, as `path:line`, or null. */
function locate(root, file, quoted) {
  if (quoted === null) return null;
  try {
    const lines = fs.readFileSync(path.join(root, MEMORY, file), "utf8").split("\n");
    const at = lines.findIndex((line) => [collapse(line), unmarked(collapse(line))].includes(quoted));
    return at < 0 ? null : `${MEMORY.split(path.sep).join("/")}/${file}:${at + 1}`;
  } catch {
    return null;
  }
}

function detailLines(item, bank, root) {
  const lines = itemLines(item, bank);
  if (item.kind !== "change" && item.kind !== "delete") return lines;
  const where = locate(root, item.file, quotedLine(item.entries[0].fact, bank(item.file)));
  return where === null ? lines : [...lines, `     at ${where}`];
}

function renderPlan(sheetFile, root, tools, ticked, always = []) {
  const text = fs.readFileSync(sheetFile, "utf8");
  const bank = diskBank(root);
  const items = itemsOf(text, bank);
  const questions = entriesOf(text).filter(({ id }) => id[0] === "Q");
  const since = text.match(SINCE);
  const head = since === null ? [] : [[`Changes since the last memory update (${since[1]}, ${since[2]}): ${since[3]}, ${since[4]}`]];
  const unlisted = always
    .filter((name) => !items.some((item) => item.kind === "write" && item.file === name))
    .map((name) => `  ${" ".repeat(String(items.length).length + 2)}write   ${name} (new): from its template, always written`);
  const asked = questions.length > 0 ? [["Questions", ...questions.map(({ id, fact }) => `  ${id}  ${fact}`)]] : [];
  const wire = ["Tools to wire", `  ${tools.map((tool) => `[${ticked.includes(tool) ? "x" : " "}] ${tool}`).join("  ")}`];
  const n = items.length;
  const examples = [`"not ${Math.max(n, 1)}"`, ...(n >= 4 ? [`"not 2-${n - 1}"`] : []), ...(questions.length > 0 ? [`"${questions[0].id}: …"`] : [])];
  const example = examples.length > 1 ? `${examples.slice(0, -1).join(", ")} or ${examples.at(-1)}` : examples[0];
  const detailFile = path.join(path.dirname(path.resolve(sheetFile)), "plan.md");
  const relative = (file) => path.relative(root, file).split(path.sep).join("/");
  const listed = [...items.map((item) => summaryLine(item, bank, String(items.length).length)), ...unlisted];
  const summary = [["Memory plan"], ...head, ...(listed.length > 0 ? [listed] : []), ...asked, wire, [`Details: ${relative(detailFile)}`, `Does this look right? Say ok, or what to change, for example ${example}.`]];
  const sections = ORDER.flatMap((kind) => {
    const own = items.filter((item) => item.kind === kind).flatMap((item) => detailLines(item, bank, root));
    if (kind === "write") own.push(...unlisted.map((line) => `  ${line.trim().replace(/^write\s+/u, "")}`));
    return own.length > 0 ? [[TITLES[kind], ...own]] : [];
  });
  const detail = [["Memory plan"], ...head, ...sections, ...asked, [`Sheet: ${relative(path.resolve(sheetFile))}`]];
  const join = (blocks) => `${blocks.map((block) => block.join("\n")).join("\n\n")}\n`;
  return { summary: join(summary), detail: join(detail), detailFile };
}

function declined(decision, count) {
  if (ALL.test(decision)) return [];
  if (decision === "no") return Array.from({ length: count }, (_, index) => index + 1);
  const but = decision.match(BUT);
  if (but === null) throw new ReplyError(`"${decision}" is not ok, no, or not <n>: write the answers into the sheet yourself`);
  const numbers = but[1].split(/\s*(?:,|and)\s*/u).flatMap((part) => {
    const [from, to = from] = part.split(/\s*[-–]\s*/u).map(Number);
    return Array.from({ length: Math.max(to - from + 1, 1) }, (_, index) => from + index);
  });
  const wrong = numbers.find((number) => number < 1 || number > count);
  if (wrong !== undefined) throw new ReplyError(`no item ${wrong}: the plan has ${count}`);
  return numbers;
}

/** Marks each item's lines yes or no; writes nothing on a ReplyError. */
function answerSheet(sheetFile, root, reply) {
  const [head, ...rest] = reply.split(CLAUSE);
  const decision = head.trim().replace(/[.,;!\s]+$/u, "").toLowerCase();
  const clauses = rest.map((clause) => clause.trim().replace(/[.,;\s]+$/u, ""));
  const text = fs.readFileSync(sheetFile, "utf8");
  const bank = diskBank(root);
  const items = itemsOf(text, bank);
  const no = new Set(declined(decision, items.length));
  const lines = text.split("\n");
  const printed = [];
  for (const item of items) {
    const value = no.has(item.n) ? "no" : "yes";
    for (const { line, id, target, fact, source } of item.entries) lines[line - 1] = `- ${id} | ${target} | ${fact} | ${source} | ${value}`;
    const quoted = item.kind === "change" || item.kind === "delete" ? quotedLine(item.entries[0].fact, bank(item.file)) : null;
    const label = quoted !== null ? `${item.file} "${quoted}"` : item.kind === "add" ? `${item.file}, ${item.section}` : item.file;
    printed.push(`${item.n} ${value}: ${label}`);
  }
  fs.writeFileSync(sheetFile, lines.join("\n"));
  return [...printed, ...clauses.map((clause) => `left to you: ${clause}`)].join("\n");
}

module.exports = { rootOf, entriesOf, itemsOf, itemLines, quoteProblems, renderPlan, answerSheet, ReplyError, MEMORY, linesOf };
