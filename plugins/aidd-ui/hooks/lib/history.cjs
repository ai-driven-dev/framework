// H1 to H8: the history of each versioned record, read from history.md, the system version its
// publications raise, the task folder each change names, and a held element that changed, or a
// validated one whose token changed value, without a new version. A git that fails only warns: a
// slow machine must not block a turn.
const fs = require("node:fs");
const nodePath = require("node:path");
const { list, parseRecord, frontMatterEnd, LINE_BREAK } = require("./markdown.cjs");
const { placed, systemOf, byId, tokensUsedBy, isElement, isSystem, problem, fm, SYSTEM_ID, INTEGER_VERSION, SEMVER, STATUS_DEPRECATED, BREAKING, BREAKING_VALUES } = require("./model.cjs");
const { checkOf, text, UI_DIR, HISTORY_FILE, WARNING } = require("./project.cjs");
const { committed, baseline, changed } = require("./committed.cjs");
const { customProperty, declarationsOf, layered, contextsOf, resolved } = require("./css.cjs");
const { cssFileOf } = require("./tokens.cjs");
const { renderOf } = require("./renders.cjs");

const TASKS_DIR = "aidd_docs/tasks/";
const VALIDATED = "validated";
const HELD_STATUSES = [VALIDATED, STATUS_DEPRECATED]; // a proposed element is still being designed
const UNVERSIONED_KEYS = ["status", "code"]; // a review, a code catch-up: no new version

const rowsOf = (project, id) => project.history.filter((row) => row.Id === id);
const inHistory = (message) => problem({ file: HISTORY_FILE }, message);
/** A system row's Task cell: the tasks one publication lists, comma-separated. */
const taskList = (cell) => list(cell?.split(",").map((task) => task.trim()).filter(Boolean));

/** A version as comparable numbers: [n] for an element, [major, minor, patch] for the system. */
function parts(version, system) {
  if (system) {
    const match = SEMVER.exec(version ?? "");
    return match ? match.slice(1).map(Number) : null;
  }
  return INTEGER_VERSION.test(version ?? "") ? [Number(version)] : null;
}

function compare(a, b) {
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}

/** Rows whose version parses, each with its parts, lowest version first. */
const byVersion = (rows, system) =>
  rows
    .map((row) => ({ row, parts: parts(row.Version, system) }))
    .filter((entry) => entry.parts)
    .sort((a, b) => compare(a.parts, b.parts));

/** Records that carry a history, which every history rule reads: all but the brand. */
const versioned = (project) => placed(project).filter((record) => fm(record).id === record.name && fm(record).kind !== "brand");

function presenceProblems(project) {
  return versioned(project)
    .filter((record) => rowsOf(project, fm(record).id).length === 0)
    .map((record) => problem(record, "no row in history.md"));
}

function duplicateProblems(project) {
  const seen = new Set();
  const claimed = new Map();
  for (const { Id: id, Version: version } of project.history) {
    const key = `${id} ${version}`;
    if (seen.has(key)) claimed.set(key, `two changes claim version ${version} of ${id}, renumber one`);
    seen.add(key);
  }
  return [...claimed.values()].map(inHistory);
}

function currentProblems(project) {
  return versioned(project)
    .filter((record) => !isSystem(record))
    .flatMap((record) => {
      const current = parts(fm(record).version, false);
      const rows = byVersion(rowsOf(project, fm(record).id), false);
      if (!current || !rows.length) return [];
      const highest = rows.at(-1);
      const problems = compare(current, highest.parts) === 0 ? [] : [`version ${fm(record).version} is not the highest history row, ${highest.row.Version}`];
      for (let index = 1; index < rows.length; index += 1) {
        const step = rows[index].parts[0] - rows[index - 1].parts[0];
        if (step > 1) problems.push(`history jumps from ${rows[index - 1].row.Version} to ${rows[index].row.Version}`);
      }
      return problems.map((message) => problem(record, message));
    });
}

function breakingProblems(project) {
  return project.history.filter((row) => !BREAKING_VALUES.includes(row.Breaking)).map((row) => inHistory(`breaking "${row.Breaking}" in version ${row.Version} of ${row.Id} must be yes or no`));
}

/** A system row publishes a list of tasks. It breaks, and raises the major version, when one of
 * them broke an element or when it says so itself, for tokens alone; otherwise it raises the
 * minor. A task no row lists yet is unpublished, never a problem. */
function publicationProblems(project) {
  if (!systemOf(project)) return [];
  const breaking = new Set(project.history.filter((row) => row.Breaking === BREAKING).map((row) => row.Task));
  const ordered = byVersion(rowsOf(project, SYSTEM_ID), true);
  return ordered.slice(1).flatMap(({ row, parts: now }, index) => {
    const before = ordered[index].parts;
    const broke = taskList(row.Task).find((task) => breaking.has(task));
    if (broke && row.Breaking !== BREAKING) return [inHistory(`${row.Version} publishes "${broke}", which breaks an element, so it is breaking`)];
    if (row.Breaking === BREAKING && now[0] <= before[0]) return [inHistory(`${row.Version} is breaking, yet raises no major version`)];
    if (compare(now.slice(0, 2), before.slice(0, 2)) <= 0) return [inHistory(`${row.Version} raises neither major nor minor`)];
    return [];
  });
}

function taskProblems(project) {
  return project.history.flatMap((row) =>
    (row.Id === SYSTEM_ID ? taskList(row.Task) : [row.Task])
      .filter((task) => !task?.startsWith(TASKS_DIR))
      .map((task) => inHistory(`task "${task ?? ""}" in version ${row.Version} of ${row.Id} must be a task folder, ${TASKS_DIR}…`))
  );
}

function deprecationProblems(project) {
  return versioned(project)
    .filter((record) => isElement(record) && fm(record).status === STATUS_DEPRECATED)
    .filter((record) => {
      const last = byVersion(rowsOf(project, fm(record).id), false).at(-1);
      return last && last.row.Breaking !== BREAKING;
    })
    .map((record) => problem(record, "deprecated, yet its last history row is not breaking"));
}

/** A record's text without what a version never covers: the status and the code links. */
function substance(content) {
  const lines = content.split(LINE_BREAK);
  const close = frontMatterEnd(lines);
  return lines.filter((line, index) => index > close || !UNVERSIONED_KEYS.some((key) => line.startsWith(`${key}:`))).join(LINE_BREAK);
}

/** Whether a record's render now differs from the committed one; a render absent on either side
 * is not a change. */
function renderChanged(project, record) {
  const file = renderOf(record);
  const before = committed(project, file);
  return before !== null && project.renders.includes(file) && text(project, file) !== before;
}

/** The committed front matter of a record that was validated or deprecated and whose version has
 * not risen since; null for any other. */
function heldFront(record, before) {
  const was = parseRecord(before).frontMatter;
  const comparable = [was.version, fm(record).version].every((version) => INTEGER_VERSION.test(version ?? ""));
  return HELD_STATUSES.includes(was.status) && comparable && Number(fm(record).version) <= Number(was.version) ? was : null;
}

function textProblems(project) {
  return placed(project)
    .filter(isElement)
    .flatMap((record) => {
      const touched = [record.file, renderOf(record)].some((file) => changed(project).has(file));
      const before = touched ? baseline(project, record.file) : null;
      const was = before === null ? null : heldFront(record, before);
      if (was === null) return [];
      const edited = substance(text(project, record.file)) !== substance(before) || renderChanged(project, record);
      return edited ? [problem(record, `edited since its committed version ${was.version}, raise its version with a history row`)] : [];
    });
}

/** The custom properties whose resolved value differs between two stylesheets, on the roots both
 * can be asked about: the base and each theme both hold, at each width either holds. */
function changedProperties(before, after) {
  const changed = new Set();
  for (const key of contextsOf([before, after])) {
    const [was, now] = [layered(before, key), layered(after, key)];
    for (const name of new Set([...was.keys(), ...now.keys()])) if (resolved(was, name) !== resolved(now, name)) changed.add(name);
  }
  return changed;
}

/** A validated element using a token whose value changed since the committed stylesheet, its
 * version unraised; a token change leaves a deprecated one as it is. `named` are the elements
 * already reported. */
function valueProblems(project, named) {
  const file = cssFileOf(project);
  const before = committed(project, file);
  const after = fs.existsSync(nodePath.join(project.root, file)) ? text(project, file) : null; // a deleted file is T10's alone
  if (before === null || after === null) return [];
  const moved = changedProperties(declarationsOf(before), declarationsOf(after));
  const index = byId(project);
  return placed(project)
    .filter((record) => isElement(record) && !named.has(record.file))
    .flatMap((record) => {
      const tokens = tokensUsedBy(index, record).filter((token) => moved.has(customProperty(token)));
      const committedRecord = tokens.length ? baseline(project, record.file) : null;
      const was = committedRecord === null ? null : heldFront(record, committedRecord);
      return was?.status !== VALIDATED ? [] : [problem(record, `value of ${tokens.join(", ")} changed since its committed version ${was.version}, raise its version with a history row`)];
    });
}

function editedProblems(project) {
  const edited = textProblems(project);
  const found = [...edited, ...valueProblems(project, new Set(edited.map((each) => each.file)))];
  return project.gitFailure ? [...found, { file: UI_DIR, severity: WARNING, message: `git failed, so nothing was held to its committed version: ${project.gitFailure}` }] : found;
}

const RULES = {
  H1: presenceProblems,
  H2: duplicateProblems,
  H3: currentProblems,
  H4: breakingProblems,
  H5: publicationProblems,
  H6: deprecationProblems,
  H7: taskProblems,
  H8: editedProblems,
};

/** Every broken history rule, in rule order. */
const check = checkOf(RULES);

module.exports = { check, TASKS_DIR };
