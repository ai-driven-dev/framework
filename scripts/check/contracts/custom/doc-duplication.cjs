"use strict";
// No two documents carry the same sentence of twelve words or more. Anchor: README.md.
// A fact copied into a second page stops being one fact: the copies drift. A sentence, not a paragraph or a file hash: a paragraph moves a word and stops matching.
// Repetition inside one page is deliberate as often as not, so only cross-file carriers count.
const fs = require("node:fs");
const path = require("node:path");

/** Only prose this repository writes and can keep in one home. */
const SCANNED_DIRECTORIES = ["docs", "aidd_docs/memory", "cli/aidd_docs/memory"];
const SCANNED_FILES = ["README.md", "cli/README.md"];
const SCANNED_GLOBS = ["plugins/*/README.md"];

const MINIMUM_WORDS = 12;

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/u;
/** Mermaid arrives fenced like any other block, so one fence rule covers both. */
const FENCE = /^(?:```|~~~)/u;
const MARKDOWN_LINK = /!?\[([^\]]*)\]\([^)]*\)/gu;
const INLINE_CODE = /`([^`]*)`/gu;
const LIST_OR_QUOTE_MARKER = /^\s*(?:[>*+-]\s+|\d+[.)]\s+)/u;
const SENTENCE_END = /(?<=[.!?])\s+/u;

/**
 * A line break ends a sentence as surely as a period does: this repository's prose is mostly
 * bullets and pointers that carry no terminator, and joining them would hide every duplicate
 * inside a paragraph-sized blob.
 */
function sentenceLines(markdown) {
  const skipped = markdown.length - markdown.replace(FRONTMATTER, "").length;
  const offset = markdown.slice(0, skipped).split("\n").length - 1;
  const found = new Map();
  let inFence = false;

  for (const [index, raw] of markdown.slice(skipped).split(/\r?\n/).entries()) {
    if (FENCE.test(raw.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const line = raw.trim();
    if (line.startsWith("#") || line.startsWith("|")) continue;

    for (const piece of line.split(SENTENCE_END)) {
      const sentence = normalise(piece);
      if (sentence.split(" ").filter(Boolean).length >= MINIMUM_WORDS && !found.has(sentence)) found.set(sentence, offset + index + 1);
    }
  }

  return found;
}

const sentencesOf = (markdown) => [...sentenceLines(markdown).keys()];

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

/** Which files carry each sentence, in the order the caller handed the files over. */
function carriersOf(filesToText) {
  const carriers = new Map();

  for (const [file, text] of Object.entries(filesToText)) {
    for (const sentence of sentencesOf(text)) {
      if (!carriers.has(sentence)) carriers.set(sentence, []);
      carriers.get(sentence).push(file);
    }
  }

  return carriers;
}

function markdownUnder(root, directory) {
  const absolute = path.resolve(root, directory);
  if (!fs.existsSync(absolute)) return [];

  return fs
    .readdirSync(absolute, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.relative(root, path.join(entry.parentPath ?? entry.path, entry.name)));
}

/** One shape only, a named file one directory down: a glob engine would be a dependency for
 * a single pattern. */
function matchingGlob(root, glob) {
  const [parent, , name] = glob.split("/");
  const absolute = path.resolve(root, parent);
  if (!fs.existsSync(absolute)) return [];

  return fs
    .readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(absolute, entry.name, name)))
    .map((entry) => path.posix.join(parent, entry.name, name));
}

function scannedFiles(root) {
  const found = [
    ...SCANNED_FILES.filter((file) => fs.existsSync(path.resolve(root, file))),
    ...SCANNED_GLOBS.flatMap((glob) => matchingGlob(root, glob)),
    ...SCANNED_DIRECTORIES.flatMap((directory) => markdownUnder(root, directory)),
  ].map((file) => file.split(path.sep).join("/"));

  // CATALOG.md is regenerated from the tree it indexes, so its lines are an output.
  return found.filter((file) => path.basename(file) !== "CATALOG.md");
}


/** Sentences carried by more than one scanned file, with those files. */
function duplicatesIn(root) {
  const files = scannedFiles(root);
  const filesToText = Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.resolve(root, file), "utf8")]));
  return [...carriersOf(filesToText)].filter(([, carriers]) => carriers.length > 1).map(([sentence, carriers]) => ({ sentence, files: carriers, lines: carriers.map((file) => sentenceLines(filesToText[file]).get(sentence)) }));
}

/** One finding in each carrier, naming the others. */
module.exports = (ctx) =>
  duplicatesIn(ctx.root).flatMap(({ sentence, files, lines }) =>
    files.map((file, i) => ({ file, line: lines[i], offending: sentence, fix: `the same sentence is also in ${files.filter((f) => f !== file).join(", ")}, keep it in one home and point the others at it` })),
  );
module.exports.sentencesOf = sentencesOf;
module.exports.sentenceLines = sentenceLines;
module.exports.carriersOf = carriersOf;
module.exports.scannedFiles = scannedFiles;
module.exports.duplicatesIn = duplicatesIn;
