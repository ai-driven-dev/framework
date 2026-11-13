#!/usr/bin/env node
"use strict";
// Usage: node check-skill.cjs <skill-folder>
// The lexical rules of ../references/skill-authoring.md, checked without judgment.
// Exit 0 clean, 1 findings, 2 usage. Node built-ins only.

const fs = require("node:fs");
const path = require("node:path");

const EXIT_OK = 0;
const EXIT_ERRORS = 1;
const EXIT_USAGE = 2;
const USAGE = "usage: check-skill.cjs <skill-folder>, a folder holding SKILL.md\n";

const DESCRIPTION_LIMIT = 150;
const FILE_LINE_LIMIT = 100;
const EXCERPT_LIMIT = 40;
const SECTION_ORDER = ["Input", "Process", "Output", "Rules"];
const ROUTER_SECTION = "Transversal rules";
const LIMITED_DIRS = ["actions", "references"];

const FENCE = /^\s*(```|~~~)/u;
const INLINE_CODE = /`[^`\n]*`/gu;
const COMMENT = /<!--[\s\S]*?--!?>/gu;
const LINK = /\[[^\]\n]*\]\(([^)\s#]+)(?:#[^)]*)?\)/gu;
const ACTION_NODE = /\["(actions\/[^"]+\.md)"\]/gu;
const BOX = /([\w-]+)\["([^"]*)"\]/gu;
const ARROWS = ["-->", "-.->", "==>"];
const SLOT = /<[a-z][^<>\n]*>/u;
const CLAUSE_BREAK = /[.!?;]\s+\S/u;
const ABBREVIATION = /\b(?:e\.g|i\.e|etc|vs|cf)\./giu;
const ITEM_SECTIONS = ["Process", "Rules", ROUTER_SECTION];
const LIST_ITEM = /^\s*(?:\d+\.|-)\s+(.*)$/u;
const SECTION_HEADING = /^##\s+(.+?)\s*$/u;
const ACTION_LINK =/\]\((?:\.\/)?(\d\d-[^)/]+\.md)\)/u;

function excerpt(text) {
  const flat = text.trim().replace(/\s+/gu, " ");
  return flat.length > EXCERPT_LIMIT ? `${flat.slice(0, EXCERPT_LIMIT - 1)}…` : flat;
}

/** Each line of a file with fenced blocks, comments and inline code blanked, so prose rules skip them. */
function proseLines(text) {
  const lines = text.replace(COMMENT, (match) => match.replace(/[^\n]/gu, " ")).split("\n");
  let fenced = false;
  return lines.map((line) => {
    if (FENCE.test(line)) {
      fenced = !fenced;
      return "";
    }
    return fenced ? "" : line.replace(INLINE_CODE, "``");
  });
}

function frontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n/u.exec(text);
  if (!match) return { fields: {}, length: 0 };
  const fields = {};
  for (const line of match[1].split("\n")) {
    const field = /^([\w-]+):\s*(.*)$/u.exec(line);
    if (field) fields[field[1]] = field[2];
  }
  return { fields, length: match[0].split("\n").length - 1 };
}

function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    });
}

function checkRouter(skill, text, report) {
  const file = "SKILL.md";
  const { fields } = frontmatter(text);
  const description = fields.description ?? "";
  const lineOf = (needle) => text.split("\n").findIndex((line) => line.includes(needle)) + 1 || 1;
  const at = lineOf("description:");
  if (description.length > DESCRIPTION_LIMIT) report.error(file, at, "description", description, `cut the description to ${DESCRIPTION_LIMIT} characters, it has ${description.length}`);
  if (description.includes(":")) report.error(file, at, "description", description, "remove the colon from the description");
  if (/\s[-–—]\s/u.test(description)) report.error(file, at, "description", description, "remove the dash separator from the description");
  if (/[.!?]\s+\S/u.test(description)) report.error(file, at, "description", description, "make the description one sentence");

  const prose = proseLines(text);
  prose.forEach((line, index) => {
    const heading = /^##\s+(.+?)\s*$/u.exec(line);
    if (heading && heading[1] !== ROUTER_SECTION) report.error(file, index + 1, "router", line, "keep only the diagram and the transversal rules after the title");
  });

  const flow = /```mermaid\n([\s\S]*?)```/u.exec(text);
  if (!flow) {
    report.error(file, 1, "diagram", undefined, "draw the actions as a flowchart LR diagram");
  } else {
    if (!/^\s*flowchart LR\b/mu.test(flow[1])) report.error(file, lineOf("```mermaid") + 1, "diagram", flow[1].split("\n")[0], "start the diagram with flowchart LR");
    const drawn = new Set([...flow[1].matchAll(ACTION_NODE)].map((match) => match[1]));
    const actionsDir = path.join(skill, "actions");
    const present = fs.existsSync(actionsDir) ? fs.readdirSync(actionsDir).filter((name) => name.endsWith(".md")).map((name) => `actions/${name}`) : [];
    for (const action of present) if (!drawn.has(action)) report.error(file, lineOf("```mermaid"), "diagram", action, `draw a node labeled ${action}`);
    for (const action of drawn) if (!present.includes(action)) report.error(file, lineOf(action), "diagram", action, "remove the node or write its action file");
    checkEdges(skill, flow[1], text.split(`## ${ROUTER_SECTION}`)[1] ?? "", lineOf, report);
  }
}

/** A box is an action file, a node id holds no path, a node leaves by one unlabeled edge at most, and an edge between two actions is a link in the source action or a transversal rule naming the target. */
function checkEdges(skill, flow, rules, lineOf, report) {
  const file = "SKILL.md";
  const actions = new Map();
  for (const [box, id, label] of flow.matchAll(BOX)) {
    if (/^actions\/[^"]+\.md$/u.test(label)) actions.set(id, label);
    else report.error(file, lineOf(box), "diagram", box, "draw only action files as boxes; cite a reference from the step that uses it");
  }
  const unlabeled = new Map();
  for (const line of flow.split("\n")) {
    const { segments, arrows } = splitArrows(line.trim());
    for (const id of segments.flatMap(nodeIds)) if (!/^[\w-]+$/u.test(id)) report.error(file, lineOf(line.trim()), "diagram", id, "name the node with a plain id; cite a file from the step that uses it");
    for (let index = 0; index + 1 < segments.length; index += 1) {
      const arrow = arrows[index];
      for (const from of nodeIds(segments[index])) {
        for (const to of nodeIds(segments[index + 1])) {
          for (const [start, end] of arrow.startsWith("<") ? [[from, to], [to, from]] : [[from, to]]) {
            if (!arrow.includes("|")) unlabeled.set(start, { line: unlabeled.get(start)?.line ?? line.trim(), targets: new Set([...(unlabeled.get(start)?.targets ?? []), end]) });
          }
          const source = actions.get(from);
          const target = actions.get(to);
          if (!source || !target || source === target) continue;
          const sourcePath = path.join(skill, source);
          const text = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, "utf8") : "";
          const name = path.basename(target);
          if (new RegExp(`\\b${name.replace(/^\d\d-|\.md$/gu, "")}\\b`, "iu").test(rules)) continue;
          const linked = [...text.matchAll(LINK)].some((match) => path.basename(match[1]) === name);
          if (!linked) report.error(file, lineOf(line.trim()), "edge", `${from} --> ${to}`, `link ${name} from the step of ${source} that takes this edge`);
        }
      }
    }
  }
  for (const [from, { line, targets }] of unlabeled) if (targets.size > 1) report.error(file, lineOf(line), "edge", `${from} --> ${[...targets].join(", ")}`, "label the condition of each edge but the default one");
}

/** Splits a diagram line into its node segments and the arrows between them, each arrow with its `<` and its `|label|`. */
function splitArrows(line) {
  const segments = [];
  const arrows = [];
  let rest = line;
  for (;;) {
    const found = ARROWS.map((token) => ({ token, at: rest.indexOf(token) })).filter(({ at }) => at >= 0);
    if (found.length === 0) break;
    const { token, at } = found.reduce((first, next) => (next.at < first.at ? next : first));
    const start = rest[at - 1] === "<" ? at - 1 : at;
    let end = at + token.length;
    const close = rest[end] === "|" ? rest.indexOf("|", end + 1) : -1;
    if (close >= 0) end = close + 1;
    segments.push(rest.slice(0, start).trim());
    arrows.push(rest.slice(start, end));
    rest = rest.slice(end);
  }
  segments.push(rest.trim());
  return { segments, arrows };
}

/** The node ids of a segment, one per `&`-joined node. */
function nodeIds(segment) {
  return segment.split("&").map((part) => /^\s*([^\s[({]+)/u.exec(part)?.[1]).filter(Boolean);
}

/** The action files the diagram draws an edge from to another action: only those end by reading the next. */
function chainedActions(router) {
  const flow = /```mermaid\n([\s\S]*?)```/u.exec(router)?.[1] ?? "";
  const actions = new Map([...flow.matchAll(BOX)].filter(([, , label]) => /^actions\//u.test(label)).map(([, id, label]) => [id, label]));
  const chained = new Set();
  for (const line of flow.split("\n")) {
    const { segments } = splitArrows(line.trim());
    for (let index = 0; index + 1 < segments.length; index += 1) {
      for (const from of nodeIds(segments[index])) {
        for (const to of nodeIds(segments[index + 1])) if (actions.has(from) && actions.has(to) && from !== to) chained.add(actions.get(from));
      }
    }
  }
  return chained;
}

function checkAction(file, text, chains, report) {
  const lines = text.split("\n");
  if (!/^# \d\d - \S/u.test(lines[0] ?? "")) report.error(file, 1, "heading", lines[0] ?? "", "start with `# <NN> - <Title>`");
  const sections = [];
  proseLines(text).forEach((line, index) => {
    const heading = /^##\s+(.+?)\s*$/u.exec(line);
    if (heading) sections.push({ name: heading[1], line: index + 1 });
  });
  let last = -1;
  for (const section of sections) {
    const rank = SECTION_ORDER.indexOf(section.name);
    if (rank < 0) report.error(file, section.line, "heading", `## ${section.name}`, `use only ${SECTION_ORDER.join(", ")} sections`);
    else if (rank < last) report.error(file, section.line, "heading", `## ${section.name}`, `order the sections ${SECTION_ORDER.join(", ")}`);
    else last = rank;
  }
  if (!chains) return;
  const process = sections.find((section) => section.name === "Process");
  if (!process) return;
  const end = sections.find((section) => section.line > process.line)?.line ?? lines.length + 1;
  let step;
  for (let index = process.line; index < end - 1; index += 1) if (/^\d+\.\s/u.test(lines[index])) step = index;
  if (step !== undefined && !ACTION_LINK.test(lines[step])) report.error(file, step + 1, "read-next", lines[step], "end with a step that reads the next action, as a link");
}

/** The text with what holds a period yet ends no sentence removed: link targets and abbreviations. */
function withoutFalseBreaks(text) {
  return text.replace(LINK, "").replace(ABBREVIATION, "");
}

/** Each numbered or dash item of a step or rule list holds one sentence, its cases as dash sub-items. */
function checkItems(file, text, report) {
  const lines = text.split("\n");
  let inside = false;
  proseLines(text).forEach((line, index) => {
    const heading = SECTION_HEADING.exec(line);
    if (heading) inside = ITEM_SECTIONS.includes(heading[1]);
    const item = inside && LIST_ITEM.exec(line);
    if (item && CLAUSE_BREAK.test(withoutFalseBreaks(item[1]))) report.error(file, index + 1, "sentence", lines[index], "split it: one sentence per item, cases as dash sub-items, or put exact text in backticks");
  });
}

/** Lexical rules every file obeys: length, bold, citations. */
function checkFile(skill, file, text, report) {
  const lines = text.split("\n");
  const markdown = file.endsWith(".md");
  if (markdown && LIMITED_DIRS.includes(file.split("/")[0]) && lines.length > FILE_LINE_LIMIT) {
    report.error(file, FILE_LINE_LIMIT + 1, "length", undefined, `split the file, it has ${lines.length} lines`);
  }
  const skip = markdown && file === "SKILL.md" ? frontmatter(text).length : 0;
  if (markdown && !file.startsWith("assets/")) {
    let fenced = false;
    const inFence = lines.map((line) => {
      if (FENCE.test(line)) fenced = !fenced;
      return fenced;
    });
    for (const match of text.matchAll(COMMENT)) {
      const line = text.slice(0, match.index).split("\n").length;
      if (inFence[line - 1]) continue;
      report.error(file, line, "slot", match[0], "state it in the prose, or move it to an asset");
    }
  }
  proseLines(text).forEach((line, index) => {
    if (index < skip) return;
    const number = index + 1;
    if (!markdown) return;
    if (!file.startsWith("assets/") && SLOT.test(line)) report.error(file, number, "slot", line, "fill the template slot, or move it to an asset");
    if (line.includes("**")) report.error(file, number, "bold", line, "write the sentence without bold");
    for (const match of line.matchAll(LINK)) {
      const target = match[1];
      if (/^[a-z]+:/iu.test(target)) continue;
      const resolved = path.resolve(path.dirname(path.join(skill, file)), target);
      if (!fs.existsSync(resolved)) report.error(file, number, "citation", match[0], `fix the link, ${target} does not exist`);
    }
  });
}

function check(skill) {
  const errors = [];
  const report = { error: (file, line, rule, offending, fix) => errors.push({ file, line, rule, ...(offending === undefined ? {} : { excerpt: excerpt(offending) }), fix }) };
  const files = walk(skill).map((full) => path.relative(skill, full).split(path.sep).join("/"));
  const actions = files.filter((file) => /^actions\/[^/]+\.md$/u.test(file)).sort();
  const chained = chainedActions(fs.readFileSync(path.join(skill, "SKILL.md"), "utf8"));
  for (const file of files) {
    const text = fs.readFileSync(path.join(skill, file), "utf8");
    if (file === "SKILL.md") checkRouter(skill, text, report);
    if (actions.includes(file)) checkAction(file, text, chained.has(file), report);
    if (file === "SKILL.md" || actions.includes(file)) checkItems(file, text, report);
    checkFile(skill, file, text, report);
  }
  return errors;
}

function format(skill, errors) {
  if (errors.length === 0) return "";
  const where = (finding) => `${path.join(skill, finding.file)}:${finding.line}`;
  const quoted = (finding) => (finding.excerpt === undefined ? "" : ` ${JSON.stringify(finding.excerpt)}`);
  const counted = (count, noun) => `${count} ${noun}${count === 1 ? "" : "s"}`;
  return [
    `${path.basename(path.resolve(skill))}: ${counted(errors.length, "error")}`,
    ...errors.map((finding) => `${where(finding)} ${finding.rule}${quoted(finding)} => ${finding.fix}`),
  ].join("\n");
}

function main(args) {
  const [skill] = args;
  if (args.length !== 1 || !fs.existsSync(path.join(skill, "SKILL.md"))) {
    process.stderr.write(USAGE);
    return EXIT_USAGE;
  }
  const findings = check(skill);
  const text = format(skill, findings);
  if (text !== "") process.stdout.write(`${text}\n`);
  return findings.length > 0 ? EXIT_ERRORS : EXIT_OK;
}

module.exports = { check };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
