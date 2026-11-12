"use strict";
/**
 * The closing message, by the plan's numbers, items drawn against HEAD as the plan was. Reads
 * only. Node built-ins only.
 */

const path = require("node:path");
const fs = require("node:fs");
const { entriesOf, itemsOf, itemLines, linesOf, MEMORY } = require("./plan.cjs");

/** The bank at HEAD: what the plan was numbered against. */
const committedBank = (previous) => (file) => {
  const found = (previous ?? []).find((one) => one.file === file);
  return found === undefined ? null : linesOf(found.text);
};

const answerOf = (item) => item.entries[0].answer.toLowerCase();

/** Lines lost first, under a title that says so. `gone` is null when they could not be checked. */
const FOLDED = 3;

/** The written files, a folder holding more than three of them read as one entry. */
function grouped(files) {
  const folderOf = (file) => (file.includes("/") ? file.slice(0, file.lastIndexOf("/") + 1) : "");
  const sizes = files.reduce((counts, file) => counts.set(folderOf(file), (counts.get(folderOf(file)) ?? 0) + 1), new Map());
  const folded = (file) => (folderOf(file) !== "" && sizes.get(folderOf(file)) > FOLDED ? folderOf(file) : undefined);
  return [...new Set(files.map((file) => (folded(file) === undefined ? file : `${folded(file)} (${sizes.get(folded(file))} files)`)))];
}

function renderReport(sheetFile, { previous, gone, why, written, wired, load }) {
  const text = fs.readFileSync(sheetFile, "utf8");
  const bank = committedBank(previous);
  const items = itemsOf(text, bank);
  const questions = entriesOf(text).filter(({ id, answer }) => id[0] === "Q" && answer === "");
  const lost = gone ?? [];
  const title = gone === null ? "Memory written, lost lines not checked" : lost.length > 0 ? `Memory written, ${lost.length} ${lost.length === 1 ? "line" : "lines"} lost` : "Memory ready";
  const blocks = [[title]];
  if (gone === null) blocks.push(["Lines lost", `  not checked: ${why}`]);
  else if (lost.length > 0) blocks.push(["Lines lost", "  No item you approved removes these lines. Restore them before you commit.", ...lost.map((line) => `  ${line}`)]);
  const shown = grouped(written);
  const touched = [...(shown.length > 0 ? [`  ${MEMORY.split(path.sep).join("/")}: ${shown.join(", ")}`] : []), ...wired.map((file) => `  ${file}: memory block`)];
  if (touched.length > 0) blocks.push(["Written", ...touched]);
  const applied = items.filter((item) => answerOf(item).startsWith("yes")).flatMap((item) => itemLines(item, bank));
  if (applied.length > 0) blocks.push(["Changed", ...applied]);
  const left = [
    ...items.filter((item) => !answerOf(item).startsWith("yes")).map((item) => `  ${item.n}. ${item.file}: ${answerOf(item).startsWith("no") ? "you declined" : "no answer recorded"}`),
    ...questions.map(({ id, file, fact }) => `  ${id}  ${fact}: unanswered. Tell me the answer any time and I add it to ${file}.`),
  ];
  if (left.length > 0) blocks.push(["Left out", ...left]);
  if (load !== null) blocks.push(["Heads-up", `  Every session loads ${load.words} words from ${load.files} ${load.files === 1 ? "file" : "files"}.`]);
  return `${blocks.map((block) => block.join("\n")).join("\n\n")}\n`;
}

module.exports = { renderReport };
