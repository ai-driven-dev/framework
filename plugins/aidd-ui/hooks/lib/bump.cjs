// Applies a change to the versions it reaches: each element or screen `impact` reaches is raised by
// one and set `proposed` with a History row, a deprecated one being left unless the change breaks,
// and each review naming a raised screen gets a `pending` verdict per state at its new version.
const fs = require("node:fs");
const path = require("node:path");
const { list } = require("./markdown.cjs");
const { placed, fm, INTEGER_VERSION } = require("./model.cjs");
const { load, text } = require("./project.cjs");
const { usages } = require("./graph.cjs");
const { TASKS_DIR } = require("./history.cjs");
const { Refusal } = require("./args.cjs");

const EXIT_REFUSED = 2;
const FENCE = "---";
const LINE_BREAK = "\n";
const ROW_START = "|";
const HISTORY_HEADING = "## History";
const VERDICTS_HEADING = "## Verdicts";
const DEPRECATED = "deprecated";
const CELL_BREAKERS = /[|\r\n]/;
const TRAILING_SEPARATORS = /\/+$/;

const refuse = (message) => new Refusal(message, EXIT_REFUSED);

/** `lines` with the front matter line `key: value` set; its absence is a refusal. */
function setFront(lines, key, value, file) {
  const close = lines.findIndex((line, at) => at > 0 && line.trimEnd() === FENCE);
  const at = lines.findIndex((line, index) => index > 0 && index < close && line.startsWith(`${key}:`));
  if (at < 0) throw refuse(`${file} has no ${key} line in its front matter`);
  lines[at] = `${key}: ${value}`;
}

/** `lines` with `row` added after the last row of the first table under `heading`. */
function addRow(lines, heading, row, file) {
  const section = lines.findIndex((line) => line.trim() === heading);
  const start = section < 0 ? -1 : lines.findIndex((line, at) => at > section && line.trim().startsWith(ROW_START));
  if (start < 0) throw refuse(`${file} has no table under "${heading}"`);
  let end = start;
  while (lines[end + 1]?.trim().startsWith(ROW_START)) end += 1;
  lines.splice(end + 1, 0, row);
}

const rowOf = (...cells) => `${ROW_START}${cells.map((cell) => (cell === "" ? " " : ` ${cell} `)).join(ROW_START)}${ROW_START}`;

/** Raises the versions `refs` reach, as `change` of `task`; returns the files changed. A refusal
 * is a `Refusal`, thrown before any file is written. */
function bump(root, { task, change, breaking, refs }) {
  const folder = path.posix.normalize(task).replace(TRAILING_SEPARATORS, "");
  if (!folder.startsWith(TASKS_DIR)) throw refuse(`the task "${task}" must be a folder under ${TASKS_DIR}`);
  if (!change.trim() || CELL_BREAKERS.test(change)) throw refuse('the change must be one line without "|"');
  const project = load(root);
  if (project === null) throw refuse("no design system under aidd_docs/ui");
  const { unknown, ...report } = usages(project, refs);
  if (unknown) throw refuse(`no token or element named ${unknown.map((ref) => `"${ref}"`).join(", ")}`);

  const records = placed(project);
  const reached = new Set([...report.elements, ...report.screens]);
  const raised = new Map(); // id -> new version
  const edited = new Map(); // file -> lines
  const linesOf = (record) => {
    if (!edited.has(record.file)) edited.set(record.file, text(project, record.file).split(LINE_BREAK));
    return edited.get(record.file);
  };
  for (const record of records.filter((each) => reached.has(fm(each).id))) {
    const held = fm(record).status === DEPRECATED;
    if (held && !breaking) continue;
    if (!INTEGER_VERSION.test(fm(record).version ?? "")) throw refuse(`${record.file}: version "${fm(record).version}" is no integer`);
    const version = Number(fm(record).version) + 1;
    const lines = linesOf(record);
    setFront(lines, "version", version, record.file);
    if (!held) setFront(lines, "status", "proposed", record.file);
    addRow(lines, HISTORY_HEADING, rowOf(version, change.trim(), breaking ? "yes" : "no", folder), record.file);
    raised.set(fm(record).id, version);
  }

  for (const review of records.filter((each) => fm(each).kind === "review")) {
    for (const id of list(fm(review).screens).filter((screen) => raised.has(screen))) {
      const screen = records.find((each) => fm(each).id === id);
      for (const state of list(fm(screen).states)) addRow(linesOf(review), VERDICTS_HEADING, rowOf(id, state, raised.get(id), "pending", ""), review.file);
    }
  }

  for (const [file, lines] of edited) fs.writeFileSync(path.join(root, file), lines.join(LINE_BREAK));
  return { changed: [...edited.keys()].sort() };
}

module.exports = { bump };
