// Applies a change to the versions it reaches: each element or screen `impact` reaches is raised by
// one and set `proposed` with a History row, once per task; a later breaking change to one already
// raised for the task turns that row to breaking instead. A deprecated one is left unless the
// change breaks a token it cites, directly or through what it uses. Each review naming a raised
// screen gets a `pending` verdict per state at its new version.
const fs = require("node:fs");
const path = require("node:path");
const { list, table } = require("./markdown.cjs");
const { placed, fm, INTEGER_VERSION } = require("./model.cjs");
const { load } = require("./project.cjs");
const { usages } = require("./graph.cjs");
const { TASKS_DIR } = require("./history.cjs");
const { Refusal } = require("./args.cjs");

const EXIT_REFUSED = 2;
const FENCE = "---";
const LINE_BREAK = "\n";
const ROW_START = "|";
const HISTORY_HEADING = "## History";
const HISTORY_SECTION = "History";
const VERDICTS_HEADING = "## Verdicts";
const DEPRECATED = "deprecated";
const BREAKING = "yes";
const ALREADY_RAISED = "already raised for this task";
const CARRIAGE_RETURN = "\r";
const CELL_BREAKERS = /[|\r\n]/;
const TRAILING_SEPARATORS = /\/+$/;

const refuse = (message) => new Refusal(message, EXIT_REFUSED);

/** `lines` with the front matter line `key: value` set, ending as `end` says; its absence is a refusal. */
function setFront(lines, key, value, end, file) {
  const close = lines.findIndex((line, at) => at > 0 && line.trimEnd() === FENCE);
  const at = lines.findIndex((line, index) => index > 0 && index < close && line.startsWith(`${key}:`));
  if (at < 0) throw refuse(`${file} has no ${key} line in its front matter`);
  lines[at] = `${key}: ${value}${end}`;
}

/** The index of the last row of the first table under `heading` in `lines`. */
function lastRowOf(lines, heading, file) {
  const section = lines.findIndex((line) => line.trim() === heading);
  const start = section < 0 ? -1 : lines.findIndex((line, at) => at > section && line.trim().startsWith(ROW_START));
  if (start < 0) throw refuse(`${file} has no table under "${heading}"`);
  let last = start;
  while (lines[last + 1]?.trim().startsWith(ROW_START)) last += 1;
  return last;
}

/** `lines` with `row` added, ending as `end` says, after the last row of the first table under `heading`. */
const addRow = (lines, heading, row, end, file) => lines.splice(lastRowOf(lines, heading, file) + 1, 0, `${row}${end}`);

const rowOf = (...cells) => `${ROW_START}${cells.map((cell) => (cell === "" ? " " : ` ${cell} `)).join(ROW_START)}${ROW_START}`;

/** Raises the versions `refs` reach, as `change` of `task`; returns the files changed and `left`,
 * the elements reached and not raised with why: deprecated, or already raised for this task and
 * left as its row says. A
 * refusal is a `Refusal`, thrown before any file is written. */
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
  // A deprecated element follows a rename or a deletion: it cites the token, or uses what does.
  const tokenRefs = refs.filter((ref) => usages(project, [ref]).tokens.length);
  const followed = breaking ? new Set([...usages(project, tokenRefs).elements, ...usages(project, tokenRefs).screens]) : new Set();
  const raised = new Map(); // id -> new version
  const left = [];
  const edited = new Map(); // file -> {lines, end}
  const editOf = (record) => {
    if (!edited.has(record.file)) {
      const content = fs.readFileSync(path.join(root, record.file), "utf8"); // as written, so a line end or a byte order mark survives
      edited.set(record.file, { lines: content.split(LINE_BREAK), end: content.includes(`${CARRIAGE_RETURN}${LINE_BREAK}`) ? CARRIAGE_RETURN : "" });
    }
    return edited.get(record.file);
  };
  for (const record of records.filter((each) => reached.has(fm(each).id))) {
    const { id } = fm(record);
    const held = fm(record).status === DEPRECATED;
    const history = table(record.sections[HISTORY_SECTION]);
    if (held && !followed.has(id)) left.push({ id, why: DEPRECATED });
    else if (history.at(-1)?.Task === folder) {
      const row = history.at(-1);
      if (!breaking || row.Breaking === BREAKING) left.push({ id, why: ALREADY_RAISED });
      else {
        const { lines, end } = editOf(record);
        lines[lastRowOf(lines, HISTORY_HEADING, record.file)] = `${rowOf(row.Version, `${row.Change}; ${change.trim()}`, BREAKING, folder)}${end}`;
      }
    }
    else {
      if (!INTEGER_VERSION.test(fm(record).version ?? "")) throw refuse(`${record.file}: version "${fm(record).version}" is no integer`);
      const version = Number(fm(record).version) + 1;
      const { lines, end } = editOf(record);
      setFront(lines, "version", version, end, record.file);
      if (!held) setFront(lines, "status", "proposed", end, record.file);
      addRow(lines, HISTORY_HEADING, rowOf(version, change.trim(), breaking ? BREAKING : "no", folder), end, record.file);
      raised.set(id, version);
    }
  }

  for (const review of records.filter((each) => fm(each).kind === "review")) {
    for (const id of list(fm(review).screens).filter((screen) => raised.has(screen))) {
      const screen = records.find((each) => fm(each).id === id);
      const { lines, end } = editOf(review);
      for (const state of list(fm(screen).states)) addRow(lines, VERDICTS_HEADING, rowOf(id, state, raised.get(id), "pending", ""), end, review.file);
    }
  }

  for (const [file, { lines }] of edited) fs.writeFileSync(path.join(root, file), lines.join(LINE_BREAK));
  return { changed: [...edited.keys()].sort(), left: left.sort((a, b) => (a.id < b.id ? -1 : 1)) };
}

module.exports = { bump };
