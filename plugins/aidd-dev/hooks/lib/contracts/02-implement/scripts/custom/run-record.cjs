"use strict";
// An implemented plan has a run.md: each run names a commit as its head, says what is left, and its last run covers every task.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { readText } = require("../../../lib/markdown.cjs");
const { readState } = require("./state.cjs");

const HEAD_LINE = /^- Head:\s*`([0-9a-f]{7,40})`\s*$/mu;
const LEFT_LINE = /^- Left:\s*\S/mu;
const RESULT_HEADER = /^\|\s*Task\s*\|\s*Validation\s*\|\s*Result\s*\|\s*$/u;
const SEPARATOR_ROW = /^\|[\s:|-]+\|$/u;

function isCommit(root, sha) {
  if (spawnSync("git", ["-C", root, "rev-parse", "--git-dir"], { encoding: "utf8" }).status !== 0) return undefined;
  return spawnSync("git", ["-C", root, "cat-file", "-e", `${sha}^{commit}`]).status === 0;
}

function resultRows(block) {
  return block
    .split("\n")
    .filter((line) => line.startsWith("|") && !RESULT_HEADER.test(line) && !SEPARATOR_ROW.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
}

module.exports = (ctx) => {
  const { planStatus, phases } = readState(ctx.root);
  if (planStatus !== "implemented") return [];
  const file = "run.md";
  const missing = { file, line: 1, fix: 'no "## Run" recorded, append one' };
  if (!fs.existsSync(path.join(ctx.root, file))) return [missing];
  const text = readText(path.join(ctx.root, file));
  const starts = [...text.matchAll(/^## Run\b/gmu)].map((match) => text.slice(0, match.index).split("\n").length);
  if (!starts.length) return [missing];
  const blocks = text.split(/^(?=## Run\b)/mu).slice(1);
  const found = [];
  blocks.forEach((block, index) => {
    const label = `run ${index + 1}`;
    const say = (fix) => found.push({ file, line: starts[index], fix: `${label}: ${fix}` });
    const head = block.match(HEAD_LINE)?.[1];
    if (!head) say('"Head:" needs a commit sha');
    else if (isCommit(ctx.root, head) === false) say(`head ${head} is not a commit`);
    if (!resultRows(block).some((row) => row.every(Boolean))) say('needs a "Task | Validation | Result" table with a row');
    if (!LEFT_LINE.test(block)) say('"Left:" missing');
  });
  const covered = new Set(resultRows(blocks.at(-1)).map((row) => row[0]));
  for (const task of phases.flatMap((phase) => phase.tasks).filter((name) => !covered.has(name))) {
    found.push({ file, line: starts.at(-1), fix: `run ${blocks.length} has no row for task ${task}` });
  }
  return found;
};
