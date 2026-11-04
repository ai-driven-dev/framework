/**
 * The format rules of a memory file, as pure functions of its text and of what the project
 * and the rest of the bank hold. Nothing here reads the disk: existence and the other files
 * come in through the context, so the engine owns every read.
 *
 * Each rule takes `{ file, text, exists, entries, others }` and returns problems:
 * `{ file, line, rule, severity, message }`.
 */

const ERROR = "error";
const WARNING = "warning";

const PROSE_WORD_LIMIT = 25;
const ITEM_WORD_LIMIT = 35;
const FILE_WORD_LIMIT = 400;
const EXCERPT_LIMIT = 40;
const SENTENCE_WORD_FLOOR = 12;

const FENCE = /^(?:```|~~~)/u;
const COMMENT_OPEN = "<!--";
const COMMENT_CLOSE = "-->";
const STRUCTURAL_LINE = /^(?:\||#|>|[-*+]\s|\d+[.)]\s)/u;
const LIST_ITEM = /^(?:[-*+]\s|\d+[.)]\s)/u;
const TABLE_SEPARATOR = /^\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?$/u;

// "run" counts only in the plural: "Steps 1-2 run" is a verb, not a count of runs.
const COUNTED_THINGS =
  "commits?|branch(?:es)?|files?|tests?|lines?|issues?|pull requests?|PRs?|users?|records?|runs|sessions?";
const COUNT_OF_THINGS = new RegExp(`\\b\\d+\\s+(?:${COUNTED_THINGS})\\b`, "iu");
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/u;
const TIME_WORDS = /\b(?:currently|as of|right now|at the moment)\b/iu;

const TEMPLATE_MARKER = "{{";
const PLACEHOLDER = /\b(?:TODO|TBD)\b(?!['\w])/u;

const BACKTICKED = /`([^`\n]+)`/gu;
const MARKDOWN_LINK = /!?\[([^\]]*)\]\([^)]*\)/gu;
const INLINE_CODE = /`([^`]*)`/gu;
const LIST_OR_QUOTE_MARKER = /^\s*(?:[>*+-]\s+|\d+[.)]\s+)/u;
const SENTENCE_END = /(?<=[.!?])\s+/u;
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/u;

function problem(file, line, rule, severity, message) {
  return { file, line, rule, severity, message };
}

/** A quoted excerpt of the offending text, cut so one line stays short. */
function excerpt(text) {
  return text.length > EXCERPT_LIMIT ? `${text.slice(0, EXCERPT_LIMIT - 1)}…` : text;
}

function wordsIn(text) {
  return text.split(/\s+/u).filter(Boolean);
}

/**
 * Each line with its number and whether it stands in a code fence or an HTML comment, the
 * two places a rule about prose must not read. A fenced diagram is a fence like any other.
 */
function classifiedLines(text) {
  const result = [];
  let inFence = false;
  let inComment = false;

  for (const [index, raw] of text.split(/\r?\n/u).entries()) {
    const line = raw.trim();
    const entry = { number: index + 1, line, skipped: true };
    result.push(entry);

    if (inFence) {
      if (FENCE.test(line)) inFence = false;
      continue;
    }
    if (FENCE.test(line)) {
      inFence = true;
      continue;
    }
    if (inComment) {
      if (line.includes(COMMENT_CLOSE)) inComment = false;
      continue;
    }
    if (line.startsWith(COMMENT_OPEN)) {
      inComment = !line.includes(COMMENT_CLOSE);
      continue;
    }
    entry.skipped = false;
  }

  return result;
}

function readableLines(text) {
  return classifiedLines(text).filter(({ skipped }) => !skipped);
}

function longProseLines({ file, text }) {
  return readableLines(text)
    .filter(({ line }) => line !== "" && !STRUCTURAL_LINE.test(line))
    .map(({ number, line }) => ({ number, count: wordsIn(line).length }))
    .filter(({ count }) => count > PROSE_WORD_LIMIT)
    .map(({ number, count }) =>
      problem(file, number, "M1", ERROR, `prose line of ${count} words, over ${PROSE_WORD_LIMIT}: make it a table, a list or a heading`)
    );
}

function volatileFacts({ file, text }) {
  const found = [];
  for (const { number, line } of readableLines(text)) {
    const prose = line.replace(INLINE_CODE, "");
    const count = prose.match(COUNT_OF_THINGS);
    const date = prose.match(ISO_DATE);
    const time = prose.match(TIME_WORDS);
    if (count) found.push(problem(file, number, "M2", ERROR, `"${excerpt(count[0])}" goes stale: name the thing, not how many`));
    else if (date) found.push(problem(file, number, "M2", ERROR, `"${excerpt(date[0])}" goes stale: state what is true, not when`));
    else if (time) found.push(problem(file, number, "M2", ERROR, `"${excerpt(time[0])}" goes stale: state what is true, not when`));
  }
  return found;
}

function unfinishedMarkers({ file, text }) {
  return readableLines(text)
    .map(({ number, line }) => ({ number, marker: line.includes(TEMPLATE_MARKER) ? TEMPLATE_MARKER : line.match(PLACEHOLDER)?.[0] }))
    .filter(({ marker }) => marker !== undefined)
    .map(({ number, marker }) => problem(file, number, "M3", ERROR, `"${marker}" unfinished: fill it or remove it`));
}

/** Copied from `scripts/check-referenced-paths.js`: a plugin never links outside itself. */
function deadReferences({ file, text, exists, entries }) {
  const found = [];

  for (const { number, line } of readableLines(text)) {
    for (const match of line.matchAll(BACKTICKED)) {
      const token = match[1].trim();
      // A command, a placeholder, a version range or a glob is not a path to resolve.
      if (/[\s<>*$|…]/u.test(token)) continue;
      if (token.startsWith(">") || token.startsWith("=")) continue;
      // Files only: a bare directory is usually a shape rather than a location.
      if (!/\.[^./]+$/u.test(token)) continue;
      // A `*.local.*` file is the reader's own and ignored by git: its absence is its normal state.
      if (/\.local\./u.test(token)) continue;
      if (!entries.has(token.split("/")[0])) continue;
      if (!exists(token)) found.push(problem(file, number, "M4", ERROR, `\`${excerpt(token)}\` names nothing on disk: fix the path or remove it`));
    }
  }

  return found;
}

function tableCells(line) {
  if (TABLE_SEPARATOR.test(line)) return [];
  return line.replace(/^\||\|$/gu, "").split("|");
}

function longItems({ file, text }) {
  const found = [];
  for (const { number, line } of readableLines(text)) {
    let items = [];
    if (line.startsWith("|")) items = tableCells(line);
    else if (LIST_ITEM.test(line)) items = [line.replace(LIST_ITEM, "")];

    if (items.some((item) => wordsIn(item).length > ITEM_WORD_LIMIT)) {
      found.push(problem(file, number, "M5", WARNING, `bullet or table cell over ${ITEM_WORD_LIMIT} words: split it`));
    }
  }
  return found;
}

function longFile({ file, text }) {
  const count = wordsIn(text).length;
  if (count <= FILE_WORD_LIMIT) return [];
  return [problem(file, 1, "M6", WARNING, `file over ${FILE_WORD_LIMIT} words: split it or cut it`)];
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
  const frontmatter = text.match(FRONTMATTER);
  const skipped = frontmatter ? frontmatter[0].split("\n").length - 1 : 0;
  const found = new Map();
  let inFence = false;

  for (const [index, raw] of text.split(/\r?\n/u).entries()) {
    if (index < skipped) continue;
    if (FENCE.test(raw.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const line = raw.trim();
    if (line.startsWith("#") || line.startsWith("|")) continue;

    for (const piece of line.split(SENTENCE_END)) {
      const sentence = normalise(piece);
      if (wordsIn(sentence).length >= SENTENCE_WORD_FLOOR && !found.has(sentence)) found.set(sentence, index + 1);
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
      found.push(problem(file, line, "M7", WARNING, `a sentence also written in ${carriers.get(sentence)}: keep it in one home`));
    }
  }
  return found;
}

const RULES = Object.freeze([
  { id: "M1", severity: ERROR, check: longProseLines },
  { id: "M2", severity: ERROR, check: volatileFacts },
  { id: "M3", severity: ERROR, check: unfinishedMarkers },
  { id: "M4", severity: ERROR, check: deadReferences },
  { id: "M5", severity: WARNING, check: longItems },
  { id: "M6", severity: WARNING, check: longFile },
  { id: "M7", severity: WARNING, check: repeatedSentences },
]);

module.exports = { ERROR, WARNING, RULES };
