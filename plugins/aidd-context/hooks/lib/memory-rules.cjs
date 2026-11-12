/**
 * The format rules of a memory file. Each takes `{ file, text, root, others }` and returns
 * `{ file, line, rule, severity, message, fix }` problems, `excerpt` and `endLine` when known.
 */

const fs = require("node:fs");
const path = require("node:path");
const { deadPaths, markdownLines, proseLines, namesIn } = require("./markdown.cjs");

const ERROR = "error";
const WARNING = "warning";

const PROSE_WORD_LIMIT = 25;
const ITEM_WORD_LIMIT = 35;
const FILE_WORD_LIMIT = 400;
const EXCERPT_LIMIT = 40;
const SENTENCE_WORD_FLOOR = 12;

const STALE_FIX = "check it against the code; keep it if true";
const STRUCTURAL_LINE = /^(?:\||#|>|[-*+]\s|\d+[.)]\s)/u;
const LIST_ITEM = /^(?:[-*+]\s|\d+[.)]\s)/u;
const TABLE_SEPARATOR = /^\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?$/u;

// Only a date: exact in every language. A count or time word needs judgment, left to the reader.
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/u;

const TEMPLATE_SLOT = /\{\{[^{}\n]*\}\}/gu;
const SKILL = "02-project-memory";
const TEMPLATES = ["assets", "templates", "memory"];

const MARKDOWN_LINK = /!?\[([^\]]*)\]\([^)]*\)/gu;
const INLINE_CODE = /`([^`]*)`/gu;
const LIST_OR_QUOTE_MARKER = /^\s*(?:[>*+-]\s+|\d+[.)]\s+)/u;
const SENTENCE_END = /(?<=[.!?])\s+/u;
const SENTENCE_LAST_WORD = /[.!?]["'”’)\]`*_]*$/u;

/** `offending` is the whole text; its cut form is the `excerpt` unless one is given. */
function problem({ offending, excerpt: shown, ...finding }) {
  const cut = shown ?? (offending === undefined ? undefined : excerpt(offending));
  return { ...finding, ...(cut === undefined ? {} : { excerpt: cut }), ...(offending === undefined ? {} : { offending }) };
}

function excerpt(text) {
  return text.length > EXCERPT_LIMIT ? `${text.slice(0, EXCERPT_LIMIT - 1)}…` : text;
}

function wordsIn(text) {
  return text.split(/\s+/u).filter(Boolean);
}

function isListItem(line) {
  return LIST_ITEM.test(line);
}

/** Prose paragraphs as `{ number, text }`; tables, headings, lists, fences, comments are not. */
function paragraphs(text) {
  const found = [];
  let current = [];
  let inItem = false;
  let afterBlank = false;
  const flush = () => {
    if (current.length > 0) found.push(current);
    current = [];
  };

  for (const entry of markdownLines(text)) {
    if (entry.kind !== "text") {
      flush();
      continue;
    }
    if (entry.source.trim() === "") {
      flush();
      afterBlank = true;
      continue;
    }
    const wasBlank = afterBlank;
    afterBlank = false;
    if (STRUCTURAL_LINE.test(entry.text)) {
      flush();
      inItem = isListItem(entry.text);
      continue;
    }
    if (inItem && (!wasBlank || /^\s/u.test(entry.source))) continue;
    inItem = false;
    current.push({ number: entry.number, text: entry.text });
    if (entry.hardBreak) flush();
  }
  flush();
  return found;
}

function sentencesIn(paragraph) {
  const found = [];
  let current = [];
  for (const { number, text } of paragraph) {
    for (const word of wordsIn(text)) {
      current.push({ word, number });
      if (SENTENCE_LAST_WORD.test(word)) {
        found.push(current);
        current = [];
      }
    }
  }
  if (current.length > 0) found.push(current);
  return found;
}

function longProseSentences({ file, text }) {
  const fix = "split it into a list or a table; keep every fact";
  return paragraphs(text)
    .flatMap(sentencesIn)
    .filter((sentence) => sentence.length > PROSE_WORD_LIMIT)
    .map((sentence) => {
      const over = `${sentence.length} words, over the recommended ${PROSE_WORD_LIMIT}`;
      const [line, endLine] = [sentence[0].number, sentence[sentence.length - 1].number];
      return problem({ file, line, endLine, rule: "M1", severity: ERROR, message: `sentence of ${over}`, fix, excerpt: over });
    });
}

function volatileFacts({ file, text }) {
  const found = [];
  for (const { number, text: line } of proseLines(text)) {
    const prose = line.replace(INLINE_CODE, "");
    const match = prose.match(ISO_DATE);
    if (!match) continue;
    const message = `"${excerpt(match[0])}" goes stale`;
    found.push(problem({ file, line: number, rule: "M2", severity: WARNING, message, fix: STALE_FIX, offending: match[0] }));
  }
  return found;
}

/** The skill's own name, a plugin prefix on it, or a folder named for the plugin around it. */
function templatesIn(skills) {
  for (const entry of namesIn(skills)) {
    for (const skill of [path.join(skills, entry), path.join(skills, entry, SKILL)]) {
      const name = path.basename(skill);
      const folder = path.join(skill, ...TEMPLATES);
      if ((name === SKILL || name.endsWith(`-${SKILL}`)) && fs.existsSync(folder)) return folder;
    }
  }
  return null;
}

/** Beside the hooks, in the tool's folder, under `.agents` for Codex, or in the skill's copy. */
function templatesFolder() {
  const hooks = path.resolve(__dirname, "..");
  const above = (levels, ...rest) => path.join(hooks, ...Array(levels).fill(".."), ...rest);
  const own = path.join(hooks, "..", ...TEMPLATES);
  return (
    templatesIn(above(1, "skills")) ??
    templatesIn(above(2, "skills")) ??
    templatesIn(above(3, ".agents", "skills")) ??
    (fs.existsSync(own) ? own : null)
  );
}

function templateSlots(name, folder) {
  if (folder === null) return [];
  const slots = new Set();
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) templateSlots(name, full).forEach((slot) => slots.add(slot));
    else if (entry.name === name) for (const [slot] of fs.readFileSync(full, "utf8").matchAll(TEMPLATE_SLOT)) slots.add(slot);
  }
  return [...slots];
}

/** Only an exact slot of the same template counts. Limit: no templates folder, nothing found. */
function unfilledSlots({ file, text, templates = templatesFolder() }) {
  const slots = templateSlots(path.posix.basename(file), templates);
  const fix = "fill it from the code";
  const found = [];
  for (const [index, line] of text.split("\n").entries()) {
    const slot = slots.find((candidate) => line.includes(candidate));
    if (slot !== undefined) {
      const message = `"${excerpt(slot)}" unfinished`;
      found.push(problem({ file, line: index + 1, rule: "M3", severity: ERROR, message, fix, offending: slot }));
    }
  }
  return found;
}

function deadReferences({ file, text, root }) {
  const fix = "fix the path; keep the fact";
  return deadPaths(text, root, path.dirname(path.join(root, file))).map(({ line, path: dead }) =>
    problem({ file, line, rule: "M4", severity: ERROR, message: `\`${excerpt(dead)}\` names nothing on disk`, fix, offending: dead })
  );
}

function tableCells(line) {
  if (TABLE_SEPARATOR.test(line)) return [];
  return line.replace(/^\||\|$/gu, "").split("|");
}

function longItems({ file, text }) {
  const found = [];
  for (const { number, text: line } of proseLines(text)) {
    let items = [];
    if (line.startsWith("|")) items = tableCells(line);
    else if (LIST_ITEM.test(line)) items = [line.replace(LIST_ITEM, "")];

    const longest = Math.max(0, ...items.map((item) => wordsIn(item).length));
    if (longest > ITEM_WORD_LIMIT) {
      const message = `bullet or cell of ${longest} words, over the recommended ${ITEM_WORD_LIMIT}`;
      found.push(problem({ file, line: number, rule: "M5", severity: WARNING, message, fix: "split it; keep every fact" }));
    }
  }
  return found;
}

function longFile({ file, text }) {
  const count = proseLines(text).reduce((total, { text: line }) => total + wordsIn(line).length, 0);
  if (count <= FILE_WORD_LIMIT) return [];
  const message = `file of ${count} words, over the recommended ${FILE_WORD_LIMIT}`;
  return [problem({ file, line: 1, rule: "M6", severity: WARNING, message, fix: "move a section to the capability file it belongs to; keep every fact" })];
}

function normalise(piece) {
  return piece
    .replace(LIST_OR_QUOTE_MARKER, "")
    .replace(MARKDOWN_LINK, "$1")
    .replace(INLINE_CODE, "$1")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/u, "");
}

/** Copied from `scripts/check-doc-duplication.js`: a line break ends a sentence too. */
function sentencesOf(text) {
  const found = new Map();
  for (const { number, text: line } of proseLines(text)) {
    if (line.startsWith("#") || line.startsWith("|")) continue;
    for (const piece of line.split(SENTENCE_END)) {
      const sentence = normalise(piece);
      if (wordsIn(sentence).length >= SENTENCE_WORD_FLOOR && !found.has(sentence)) found.set(sentence, number);
    }
  }
  return found;
}

function repeatedSentences({ file, text, others }) {
  const carriers = new Map();
  for (const [other, otherText] of Object.entries(others)) {
    for (const sentence of sentencesOf(otherText).keys()) {
      if (!carriers.has(sentence)) carriers.set(sentence, other);
    }
  }

  const found = [];
  for (const [sentence, line] of sentencesOf(text)) {
    if (carriers.has(sentence)) {
      const carrier = carriers.get(sentence);
      const message = `a sentence also written in ${carrier}`;
      found.push(problem({ file, line, rule: "M7", severity: WARNING, message, fix: "keep it in one home", excerpt: carrier }));
    }
  }
  return found;
}

const RULES = Object.freeze([
  { id: "M1", severity: ERROR, check: longProseSentences },
  { id: "M2", severity: WARNING, check: volatileFacts },
  { id: "M3", severity: ERROR, check: unfilledSlots },
  { id: "M4", severity: ERROR, check: deadReferences },
  { id: "M5", severity: WARNING, check: longItems },
  { id: "M6", severity: WARNING, check: longFile },
  { id: "M7", severity: WARNING, check: repeatedSentences },
]);

// By rule id; the table in `memory-rules.md` states the same ones.
const LIMITS = Object.freeze({ M1: PROSE_WORD_LIMIT, M5: ITEM_WORD_LIMIT, M6: FILE_WORD_LIMIT, M7: SENTENCE_WORD_FLOOR });

module.exports = { ERROR, WARNING, RULES, LIMITS, wordsIn };
