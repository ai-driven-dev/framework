/**
 * The format rules of a memory file, as functions of its text and of what the project and the
 * rest of the bank hold. The engine reads the bank and passes the other files in the context;
 * M4 reads the disk through the shared hook library, under the project root it is given, and M3
 * reads the skill's templates.
 *
 * Each rule takes `{ file, text, root, others }` and returns problems:
 * `{ file, line, rule, severity, message, fix }`, plus the offending `excerpt` when there is one
 * and `endLine` when the problem spans several lines. `message` says what is wrong and `fix` what
 * to do, apart, as the findings formatter prints them.
 */

const fs = require("node:fs");
const path = require("node:path");
const { deadPaths, markdownLines, proseLines, namesIn } = require("./common-rules.cjs");

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

// A count is a number, in digits or words, before a plural noun, whatever the noun, with at most
// one word between ("4 pull requests"). A digit stuck to a name, a version, a time, a port, a
// range or a thousands separator is not one, and "one" alone is a pronoun too often to count.
// Limits: "two" and "three" are left out, they open design prose more often than a count ("three
// files" and "Two gates" pass), and a label followed by a number and a verb ("Step 2 shows
// errors") reads as a count.
const NUMBER_WORDS = [
  "four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen",
  "eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred",
].join("|");
const NOT_NOUNS = "of|with|for|on|in|to|and|or|at|by|per|its";
const PLURAL_NOUN = `(?!(?:${NOT_NOUNS})\\b)(?:[a-z]+\\s+)?(?!(?:${NOT_NOUNS})\\b)(?![a-z]*(?:ss|us|is)\\b)[a-z]{2,}s\\b`;
const COUNT_OF_THINGS = new RegExp(`(?<![\\w.:+#/,-])(?:\\d{1,6}|${NUMBER_WORDS})\\s+${PLURAL_NOUN}`, "iu");
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/u;
const TIME_WORDS = /\b(?:currently|as of|right now|at the moment)\b/iu;

const TEMPLATE_SLOT = /\{\{[^{}\n]*\}\}/gu;
const SKILL = "02-project-memory";
const TEMPLATES = ["assets", "templates", "memory"];

const MARKDOWN_LINK = /!?\[([^\]]*)\]\([^)]*\)/gu;
const INLINE_CODE = /`([^`]*)`/gu;
const LIST_OR_QUOTE_MARKER = /^\s*(?:[>*+-]\s+|\d+[.)]\s+)/u;
const SENTENCE_END = /(?<=[.!?])\s+/u;
const SENTENCE_LAST_WORD = /[.!?]["'”’)\]`*_]*$/u;

/**
 * One finding. `offending` is the whole text it stands on, and its cut form is the `excerpt`
 * unless one is given.
 */
function problem({ offending, excerpt: shown, ...finding }) {
  const cut = shown ?? (offending === undefined ? undefined : excerpt(offending));
  return { ...finding, ...(cut === undefined ? {} : { excerpt: cut }), ...(offending === undefined ? {} : { offending }) };
}

/** A quoted excerpt of the offending text, cut so one line stays short. */
function excerpt(text) {
  return text.length > EXCERPT_LIMIT ? `${text.slice(0, EXCERPT_LIMIT - 1)}…` : text;
}

function wordsIn(text) {
  return text.split(/\s+/u).filter(Boolean);
}

function isListItem(line) {
  return LIST_ITEM.test(line);
}

/**
 * The paragraphs of a file: the lines of prose that run together once rendered, each as
 * `{ number, text }`. A table, a heading, a quote, a list item and the lines continuing it, a fence,
 * a comment, indented code and front matter are not prose. A line ending in a hard break ends its
 * paragraph, so a stack of labelled lines is one unit each.
 */
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

/** The sentences of a paragraph, each as its words and the lines it starts and ends on. */
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
  const fix = "make it a table, a list or a heading";
  return paragraphs(text)
    .flatMap(sentencesIn)
    .filter((sentence) => sentence.length > PROSE_WORD_LIMIT)
    .map((sentence) => {
      const over = `${sentence.length} words, over ${PROSE_WORD_LIMIT}`;
      const [line, endLine] = [sentence[0].number, sentence[sentence.length - 1].number];
      return problem({ file, line, endLine, rule: "M1", severity: ERROR, message: `sentence of ${over}`, fix, excerpt: over });
    });
}

function volatileFacts({ file, text }) {
  const found = [];
  for (const { number, text: line } of proseLines(text)) {
    const prose = line.replace(INLINE_CODE, "");
    const match = prose.match(COUNT_OF_THINGS) ?? prose.match(ISO_DATE) ?? prose.match(TIME_WORDS);
    if (!match) continue;
    const message = `"${excerpt(match[0])}" goes stale`;
    found.push(problem({ file, line: number, rule: "M2", severity: WARNING, message, fix: STALE_FIX, offending: match[0] }));
  }
  return found;
}

/** The templates folder of the skill held by a `skills` folder: the skill's own name, a plugin
 * prefix on it (`aidd-context-02-project-memory`), or a folder named for the plugin around it. */
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

/**
 * The skill's templates folder, found from the hooks folder this library sits in: beside it in the
 * plugin tree, in the tool's own folder in a flat build, under the project's `.agents` for a flat
 * Codex build, or in the skill that carries its own copy of the hooks.
 */
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

/** Every `{{…}}` slot of the template named `name`, wherever it sits under the templates folder. */
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

/**
 * A slot copied from the template of the same name and left unfilled, fences included. Only an
 * exact slot of that template counts, so a `{{` of GitHub Actions, Helm or Vue, TODO and TBD are
 * never flagged. Limit: with no templates folder next to the library, nothing is found.
 */
function unfilledSlots({ file, text, templates = templatesFolder() }) {
  const slots = templateSlots(path.posix.basename(file), templates);
  const fix = "fill it or remove it";
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

/** The dead-path rule every plugin applies to its own files, from the shared hook library. */
function deadReferences({ file, text, root }) {
  const fix = "fix the path or remove it";
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

    if (items.some((item) => wordsIn(item).length > ITEM_WORD_LIMIT)) {
      const message = `bullet or table cell over ${ITEM_WORD_LIMIT} words`;
      found.push(problem({ file, line: number, rule: "M5", severity: WARNING, message, fix: "split it" }));
    }
  }
  return found;
}

function longFile({ file, text }) {
  const count = proseLines(text).reduce((total, { text: line }) => total + wordsIn(line).length, 0);
  if (count <= FILE_WORD_LIMIT) return [];
  const message = `file over ${FILE_WORD_LIMIT} words`;
  return [problem({ file, line: 1, rule: "M6", severity: WARNING, message, fix: "split it or cut it" })];
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

/**
 * Copied from `scripts/check-doc-duplication.js`: a line break ends a sentence as surely as a
 * period, and tables and headings are skipped. Returns each sentence with its first line.
 */
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

// The limits the rules enforce, by rule id: the table in `memory-rules.md` states the same ones.
const LIMITS = Object.freeze({ M1: PROSE_WORD_LIMIT, M5: ITEM_WORD_LIMIT, M6: FILE_WORD_LIMIT, M7: SENTENCE_WORD_FLOOR });

module.exports = { ERROR, WARNING, RULES, LIMITS };
