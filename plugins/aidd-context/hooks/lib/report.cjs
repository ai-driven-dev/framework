"use strict";
/**
 * The closing message, by the plan's numbers, items drawn against the bank the plan snapshotted
 * and checked against the bank on disk. Reads only. Node built-ins only.
 */

const path = require("node:path");
const fs = require("node:fs");
const { entriesOf, itemsOf, itemLines, quotedLine, diskBank, linesOf, MEMORY } = require("./plan.cjs");
const { unmarked } = require("./bank-guard.cjs");

/** The bank at the plan: what the plan was numbered against. */
const snapshotBank = (previous) => (file) => {
  const found = (previous ?? []).find((one) => one.file === file);
  return found === undefined ? null : linesOf(found.text);
};

const answerOf = (item) => item.entries[0].answer.toLowerCase();

/** Whether the bank on disk shows the item applied; an addition is seen only as its file written. */
function seen(item, { previous, bank, written, root }) {
  const [first] = item.entries;
  const moved = first.fact.match(/^move\s+(\S+)\s+to\s+(\S+)/iu);
  if (moved !== null) return (previous ?? []).some(({ file }) => `${MEMORY}/${file}`.startsWith(moved[1].replace(/^\.\//u, "")) && !fs.existsSync(path.join(root, MEMORY, file)));
  const quoted = item.kind === "change" || item.kind === "delete" ? quotedLine(first.fact, bank(item.file)) : null;
  if (quoted === null) return written.includes(item.file);
  return !(diskBank(root)(item.file) ?? []).some((line) => line === quoted || unmarked(line) === quoted);
}

/** What the person is told about an item the report does not list as changed. */
function leftOut(item, found) {
  const answer = answerOf(item);
  if (answer.startsWith("yes")) return "approved, but the bank does not show it applied";
  if (answer.startsWith("no")) return found && item.kind !== "add" ? "you declined, but the bank shows it applied" : "you declined";
  return "no answer recorded";
}

/** Lines lost first, under a title that says so. `gone` is null when they could not be checked. */
const FOLDED = 3;

/** The written files, a folder holding more than three of them read as one entry. */
function grouped(files) {
  const folderOf = (file) => (file.includes("/") ? file.slice(0, file.lastIndexOf("/") + 1) : "");
  const sizes = files.reduce((counts, file) => counts.set(folderOf(file), (counts.get(folderOf(file)) ?? 0) + 1), new Map());
  const folded = (file) => (folderOf(file) !== "" && sizes.get(folderOf(file)) > FOLDED ? folderOf(file) : undefined);
  return [...new Set(files.map((file) => (folded(file) === undefined ? file : `${folded(file)} (${sizes.get(folded(file))} files)`)))];
}

function renderReport(sheetFile, { previous, gone, why, written, wired, load, root }) {
  const text = fs.readFileSync(sheetFile, "utf8");
  const bank = snapshotBank(previous);
  const items = itemsOf(text, bank);
  const found = new Map(items.map((item) => [item, seen(item, { previous, bank, written, root })]));
  const questions = entriesOf(text).filter(({ id, answer }) => id[0] === "Q" && answer === "");
  const lost = gone ?? [];
  const title = gone === null ? "Memory written, lost lines not checked" : lost.length > 0 ? `Memory written, ${lost.length} ${lost.length === 1 ? "line" : "lines"} lost` : "Memory ready";
  const blocks = [[title]];
  if (gone === null) blocks.push(["Lines lost", `  not checked: ${why}`]);
  else if (lost.length > 0) blocks.push(["Lines lost", "  No item you approved removes these lines. Restore them before you commit.", ...lost.map((line) => `  ${line}`)]);
  const shown = grouped(written);
  const touched = [...(shown.length > 0 ? [`  ${MEMORY.split(path.sep).join("/")}: ${shown.join(", ")}`] : []), ...wired.map((file) => `  ${file}: memory block`)];
  if (touched.length > 0) blocks.push(["Written", ...touched]);
  const applied = items.filter((item) => answerOf(item).startsWith("yes") && found.get(item)).flatMap((item) => itemLines(item, bank));
  if (applied.length > 0) blocks.push(["Changed", ...applied]);
  const left = [
    ...items.filter((item) => !(answerOf(item).startsWith("yes") && found.get(item))).map((item) => `  ${item.n}. ${item.file}: ${leftOut(item, found.get(item))}`),
    ...questions.map(({ id, file, fact }) => `  ${id}  ${fact}: unanswered. Tell me the answer any time and I add it to ${file}.`),
  ];
  if (left.length > 0) blocks.push(["Left out", ...left]);
  if (load !== null) blocks.push(["Heads-up", `  Every session loads ${load.words} words from ${load.files} ${load.files === 1 ? "file" : "files"}.`]);
  return `${blocks.map((block) => block.join("\n")).join("\n\n")}\n`;
}

module.exports = { renderReport };
