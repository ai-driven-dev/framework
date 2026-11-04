// H1 to H9: the history of each versioned record, read from history.md, the system version its
// publications raise, the task folder each change names, a held element whose fingerprint no
// longer matches the one its validation wrote, and a removal its records do not follow.
const crypto = require("node:crypto");
const fs = require("node:fs");
const nodePath = require("node:path");
const { list, frontMatterEnd, LINE_BREAK } = require("./markdown.cjs");
const { placed, systemOf, byId, tokensUsedBy, isElement, isSystem, problem, fm, SYSTEM_ID, INTEGER_VERSION, SEMVER, STATUS_DEPRECATED, BREAKING, BREAKING_VALUES } = require("./model.cjs");
const { checkOf, text, unreadable, HISTORY_FILE } = require("./project.cjs");
const { customProperty, declarationsOf, layered, contextsOf, resolved } = require("./css.cjs");
const { cssFileOf } = require("./tokens.cjs");
const { renderOf } = require("./renders.cjs");

const TASKS_DIR = "aidd_docs/tasks/";
const VALIDATED = "validated";
const HELD_STATUSES = [VALIDATED, STATUS_DEPRECATED]; // a proposed element is still being designed
const UNVERSIONED_KEYS = ["status", "code"]; // a review, a code catch-up: no new version
const FINGERPRINT_LENGTH = 12;
const REMOVED = "removed"; // the Change of the row that takes an id out of the design system

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
  const removed = removedIds(project);
  return versioned(project)
    .filter((record) => !isSystem(record) && !removed.has(fm(record).id))
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

/** The task folders a task of which broke an element: the Task of every breaking row. */
const brokenTasks = (project) => new Set(project.history.filter((row) => row.Breaking === BREAKING).map((row) => row.Task));

/** A system row publishes a list of tasks. It breaks, and raises the major version, when one of
 * them broke an element or when it says so itself, for tokens alone; otherwise it raises the
 * minor. A task no row lists yet is unpublished, never a problem. */
function publicationProblems(project) {
  if (!systemOf(project)) return [];
  const breaking = brokenTasks(project);
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

/** The custom property values a stylesheet holds, by context key, read once per run; empty
 * without one, which is T10's. */
function sheetOf(project) {
  if (!project.fingerprintSheet) {
    const file = cssFileOf(project);
    const css = fs.existsSync(nodePath.join(project.root, file)) ? text(project, file) : null;
    const sheet = css === null ? new Map() : declarationsOf(css);
    project.fingerprintSheet = new Map(contextsOf([sheet]).map((key) => [key, layered(sheet, key)]));
  }
  return project.fingerprintSheet;
}

/** What an element is as validated, hashed: its record without the unversioned keys, its render
 * when there is one, an asset's file bytes when it has one, then each token it uses with its
 * resolved value in every context of tokens.css, one `token TAB context TAB value` line each, sorted.
 * Each part is its label, a NUL, its content and a NUL. The first 12 hex characters of the sha256. */
function fingerprint(project, record) {
  const hash = crypto.createHash("sha256");
  const part = (label, content) => hash.update(`${label}\0`).update(content).update("\0");
  part("record", substance(text(project, record.file) ?? ""));
  const render = renderOf(record);
  if (project.renders.includes(render)) part("render", text(project, render) ?? "");
  const asset = fm(record).kind === "asset" && typeof fm(record).file === "string" ? nodePath.join(project.root, nodePath.dirname(record.file), fm(record).file) : null;
  if (asset && fs.existsSync(asset)) part("asset", fs.readFileSync(asset));
  const tokens = tokensUsedBy(byId(project), record);
  const lines = [...sheetOf(project)].flatMap(([key, values]) =>
    tokens.flatMap((token) => {
      const value = resolved(values, customProperty(token));
      return value === undefined ? [] : [`${token}\t${key}\t${value}`];
    })
  );
  part("tokens", lines.sort().join(LINE_BREAK));
  return hash.digest("hex").slice(0, FINGERPRINT_LENGTH);
}

/** The row of a record's current version, or undefined. */
const currentRow = (project, record) => project.history.find((row) => row.Id === fm(record).id && row.Version === fm(record).version);

/** A validated element is held to the fingerprint `publish` wrote in its current row; a deprecated
 * one only when that row carries one. A proposed or draft element is still being designed. */
function fingerprintProblems(project) {
  return placed(project)
    .filter((record) => isElement(record) && HELD_STATUSES.includes(fm(record).status))
    .flatMap((record) => {
      const row = currentRow(project, record);
      if (!row) return []; // H1 and H3 name it
      const written = row.Fingerprint ?? "";
      if (written === "") return fm(record).status === VALIDATED ? [problem(record, `validated without a fingerprint, run publish ${fm(record).id}`)] : [];
      return written === fingerprint(project, record) ? [] : [problem(record, `edited since version ${fm(record).version} was validated, raise its version with bump`)];
    });
}

/** The last row of each id, by version, the system aside. */
function lastRows(project) {
  const ids = new Set(project.history.map((row) => row.Id).filter((id) => id !== SYSTEM_ID));
  return [...ids].flatMap((id) => byVersion(rowsOf(project, id), false).slice(-1).map(({ row }) => row));
}

/** The ids whose last row removes them. */
const removedIds = (project) => new Set(lastRows(project).filter((row) => row.Change === REMOVED).map((row) => row.Id));

/** A removed id keeps no record, and an id with history keeps its record until a row removes it. */
function removalProblems(project) {
  const index = byId(project);
  const blind = unreadable(project).length > 0; // a record in a folder it cannot list is not missing
  return lastRows(project).flatMap((row) => {
    const record = index.get(row.Id);
    if (row.Change === REMOVED) return record ? [problem(record, "removed in history.md, delete its record and render")] : [];
    const kept = record || blind || project.records.some((each) => each.name === row.Id); // a record R1 or R4 already names
    return kept ? [] : [inHistory(`${row.Id} has history but no record: restore it or run bump --removed`)];
  });
}

const RULES = {
  H1: presenceProblems,
  H2: duplicateProblems,
  H3: currentProblems,
  H4: breakingProblems,
  H5: publicationProblems,
  H6: deprecationProblems,
  H7: taskProblems,
  H8: fingerprintProblems,
  H9: removalProblems,
};

/** Every broken history rule, in rule order. */
const check = checkOf(RULES);

module.exports = { check, fingerprint, currentRow, TASKS_DIR, REMOVED, VALIDATED, byVersion, rowsOf, taskList, brokenTasks };
