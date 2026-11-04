// Raises the versions a change reaches and writes their history rows, or the first row of a created record.
const fs = require("node:fs");
const path = require("node:path");
const { list, cells, frontMatterEnd, LINE_BREAK } = require("./markdown.cjs");
const { placed, byId, isSystem, fm, INTEGER_VERSION, STATUS_DEPRECATED, BREAKING, NOT_BREAKING } = require("./model.cjs");
const { Refusal, NO_DESIGN_SYSTEM, load, withoutTrailingSeparators, HISTORY_FILE } = require("./project.cjs");
const { usages } = require("./graph.cjs");
const { citations, tokenNameOf } = require("./tokens.cjs");
const { TASKS_DIR } = require("./history.cjs");

const EXIT_REFUSED = 2;
const ROW_START = "|";
const HISTORY_HEADER = ["# History", "", "| Id | Version | Change | Breaking | Task |", "| --- | --- | --- | --- | --- |"].join(LINE_BREAK) + LINE_BREAK;
const FIRST_VERSION = "1";
const FIRST_SYSTEM_VERSION = "1.0.0";
const CREATED = "created";
const VERDICTS_HEADING = "## Verdicts";
const ALREADY_RAISED = "already raised for this task";
const CARRIAGE_RETURN = "\r";
const CELL_BREAKERS = /[|\r\n]/;

const refuse = (message) => new Refusal(message, EXIT_REFUSED);

/** `lines` with the front matter line `key: value` set, ending as `end` says; its absence is a refusal. */
function setFront(lines, key, value, end, file) {
  const close = frontMatterEnd(lines);
  const at = lines.findIndex((line, index) => index > 0 && index < close && line.startsWith(`${key}:`));
  if (at < 0) throw refuse(`${file} has no ${key} line in its front matter`);
  lines[at] = `${key}: ${value}${end}`;
}

/** The index of the last row of the first table under `heading` in `lines`, or of the first table when there is no heading. */
function lastRowOf(lines, heading, file) {
  const section = heading === null ? -1 : lines.findIndex((line) => line.trim() === heading);
  const start = heading !== null && section < 0 ? -1 : lines.findIndex((line, at) => at > section && line.trim().startsWith(ROW_START));
  if (start < 0) throw refuse(heading === null ? `${file} has no table` : `${file} has no table under "${heading}"`);
  let last = start;
  while (lines[last + 1]?.trim().startsWith(ROW_START)) last += 1;
  return last;
}

/** `lines` with `row` added, ending as `end` says, after the last row of the first table under `heading`. */
const addRow = (lines, heading, row, end, file) => lines.splice(lastRowOf(lines, heading, file) + 1, 0, `${row}${end}`);

const rowOf = (...cells) => `${ROW_START}${cells.map((cell) => (cell === "" ? " " : ` ${cell} `)).join(ROW_START)}${ROW_START}`;

/** The lines of the files being changed, each with the line end it was written with, and what
 * writing them takes. */
function editing(root) {
  const edited = new Map(); // file -> {lines, end}
  return {
    editOf(file, fallback = null) {
      if (!edited.has(file)) {
        const full = path.join(root, file);
        const content = fallback !== null && !fs.existsSync(full) ? fallback : fs.readFileSync(full, "utf8"); // as written, so a line end or a byte order mark survives
        edited.set(file, { lines: content.split(LINE_BREAK), end: content.includes(`${CARRIAGE_RETURN}${LINE_BREAK}`) ? CARRIAGE_RETURN : "" });
      }
      return edited.get(file);
    },
    save() {
      for (const [file, { lines }] of edited) fs.writeFileSync(path.join(root, file), lines.join(LINE_BREAK));
      return [...edited.keys()].sort();
    },
  };
}

/** The index of the row of `id` at `version` in the history `lines`. */
const rowAt = (lines, id, version) => lines.findIndex((line) => {
  const [rowId, rowVersion] = cells(line);
  return rowId === id && rowVersion === String(version);
});

/** Writes the first row of each record named, its version 1 and its task `folder`: the system's
 * first publication is 1.0.0. */
function create(root, folder, ids) {
  const project = load(root);
  if (project === null) throw refuse(NO_DESIGN_SYSTEM);
  const index = byId(project);
  const files = editing(root);
  const { lines, end } = files.editOf(HISTORY_FILE, HISTORY_HEADER);
  for (const id of new Set(ids)) {
    const record = index.get(id);
    if (!record || fm(record).kind === "brand") throw refuse(`no versioned record named "${id}"`);
    if (project.history.some((row) => row.Id === id)) throw refuse(`"${id}" already has history`);
    addRow(lines, null, rowOf(id, isSystem(record) ? FIRST_SYSTEM_VERSION : FIRST_VERSION, CREATED, NOT_BREAKING, folder), end, HISTORY_FILE);
  }
  return { changed: files.save() };
}

/** Raises the versions `refs` reach, as `change` of `task`, or with `created` writes the first row
 * of the records `refs` name. Returns the files changed and, for a change, `left`, the elements
 * reached and not raised with why: deprecated, or already raised for this task and left as its row
 * says. A refusal is a `Refusal`, thrown before any file is written. */
function bump(root, { task, change, breaking, created, refs }) {
  const folder = withoutTrailingSeparators(path.posix.normalize(task));
  if (!folder.startsWith(TASKS_DIR)) throw refuse(`the task "${task}" must be a folder under ${TASKS_DIR}`);
  if (created) return create(root, folder, refs);
  if (!change.trim() || CELL_BREAKERS.test(change)) throw refuse('the change must be one line without "|"');
  const project = load(root);
  if (project === null) throw refuse(NO_DESIGN_SYSTEM);
  const { unknown, ...report } = usages(project, refs);
  if (unknown) throw refuse(`no token or element named ${unknown.map((ref) => `"${ref}"`).join(", ")}`);

  const records = placed(project);
  const reached = new Set([...report.elements, ...report.screens]);
  // A deprecated element follows a rename or a deletion: it cites the token, or uses what does.
  const cites = citations(project);
  const viaTokens = breaking ? usages(project, refs.filter((ref) => cites.has(tokenNameOf(project, ref)))) : { elements: [], screens: [] };
  const followed = new Set([...viaTokens.elements, ...viaTokens.screens]);
  const raised = new Map(); // id -> new version
  const left = [];
  const files = editing(root);
  const historyOf = () => files.editOf(HISTORY_FILE, HISTORY_HEADER);
  for (const record of records.filter((each) => reached.has(fm(each).id))) {
    const { id } = fm(record);
    const held = fm(record).status === STATUS_DEPRECATED;
    const current = project.history.find((row) => row.Id === id && row.Version === fm(record).version);
    if (held && !followed.has(id)) left.push({ id, why: STATUS_DEPRECATED });
    else if (current?.Task === folder) {
      if (!breaking || current.Breaking === BREAKING) left.push({ id, why: ALREADY_RAISED });
      else {
        const { lines, end } = historyOf();
        lines[rowAt(lines, id, current.Version)] = `${rowOf(id, current.Version, `${current.Change}; ${change.trim()}`, BREAKING, folder)}${end}`;
      }
    }
    else {
      if (!INTEGER_VERSION.test(fm(record).version ?? "")) throw refuse(`${record.file}: version "${fm(record).version}" is no integer`);
      const version = Number(fm(record).version) + 1;
      const { lines, end } = files.editOf(record.file);
      setFront(lines, "version", version, end, record.file);
      if (!held) setFront(lines, "status", "proposed", end, record.file);
      const history = historyOf();
      addRow(history.lines, null, rowOf(id, version, change.trim(), breaking ? BREAKING : NOT_BREAKING, folder), history.end, HISTORY_FILE);
      raised.set(id, version);
    }
  }

  for (const review of records.filter((each) => fm(each).kind === "review")) {
    for (const id of list(fm(review).screens).filter((screen) => raised.has(screen))) {
      const screen = records.find((each) => fm(each).id === id);
      const { lines, end } = files.editOf(review.file);
      for (const state of list(fm(screen).states)) addRow(lines, VERDICTS_HEADING, rowOf(id, state, raised.get(id), "pending", ""), end, review.file);
    }
  }

  return { changed: files.save(), left: left.sort((a, b) => (a.id < b.id ? -1 : 1)) };
}

module.exports = { bump };
