// H1 to H7: each versioned record's history, the system version its publications raise, and
// the task folder each change names.
const { table, list } = require("./markdown.cjs");
const { placed, systemOf, isElement, fm, INTEGER_VERSION, SEMVER } = require("./records.cjs");
const { checkOf } = require("./project.cjs");

const HISTORY_SECTION = "History";
const BREAKING_VALUES = ["yes", "no"];
const BREAKING = "yes";
const SYSTEM_KIND = "system";
const TASKS_DIR = "aidd_docs/tasks/";

const problem = (record, message) => ({ file: record.file, message });
const isSystem = (record) => fm(record).kind === SYSTEM_KIND;
const rowsOf = (record) => table(record.sections[HISTORY_SECTION]);
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

/** Records that carry a version, which every history rule reads. */
const versioned = (project) => placed(project).filter((record) => "version" in fm(record));

function presenceProblems(project) {
  return versioned(project)
    .filter((record) => rowsOf(record).length === 0)
    .map((record) => problem(record, `no "## ${HISTORY_SECTION}" table`));
}

function duplicateProblems(project) {
  return versioned(project).flatMap((record) => {
    const seen = new Set();
    const claimed = new Set();
    for (const row of rowsOf(record)) (seen.has(row.Version) ? claimed : seen).add(row.Version);
    return [...claimed].map((version) => problem(record, `two changes claim version ${version}, renumber one`));
  });
}

function currentProblems(project) {
  return versioned(project).flatMap((record) => {
    const system = isSystem(record);
    const current = parts(fm(record).version, system);
    const rows = byVersion(rowsOf(record), system);
    if (!current || !rows.length) return [];
    const highest = rows.at(-1);
    const problems = compare(current, highest.parts) === 0 ? [] : [`version ${fm(record).version} is not the highest history row, ${highest.row.Version}`];
    if (!system) {
      for (let index = 1; index < rows.length; index += 1) {
        const step = rows[index].parts[0] - rows[index - 1].parts[0];
        if (step > 1) problems.push(`history jumps from ${rows[index - 1].row.Version} to ${rows[index].row.Version}`);
      }
    }
    return problems.map((message) => problem(record, message));
  });
}

function breakingProblems(project) {
  return versioned(project).flatMap((record) =>
    rowsOf(record)
      .filter((row) => !BREAKING_VALUES.includes(row.Breaking))
      .map((row) => problem(record, `breaking "${row.Breaking}" in version ${row.Version} must be yes or no`))
  );
}

/** The tasks that broke an element, read from every element history. */
function breakingTasks(project) {
  const tasks = new Set();
  for (const record of versioned(project).filter((candidate) => !isSystem(candidate))) {
    for (const row of rowsOf(record)) if (row.Breaking === BREAKING) tasks.add(row.Task);
  }
  return tasks;
}

/** A system row publishes a list of tasks. It breaks, and raises the major version, when one of
 * them broke an element or when it says so itself, for tokens alone; otherwise it raises the
 * minor. A task no row lists yet is unpublished, never a problem. */
function publicationProblems(project) {
  const system = systemOf(project);
  if (!system) return [];
  const breaking = breakingTasks(project);
  const ordered = byVersion(rowsOf(system), true);
  return ordered.slice(1).flatMap(({ row, parts: now }, index) => {
    const before = ordered[index].parts;
    const broke = taskList(row.Task).find((task) => breaking.has(task));
    if (broke && row.Breaking !== BREAKING) return [problem(system, `${row.Version} publishes "${broke}", which breaks an element, so it is breaking`)];
    if (row.Breaking === BREAKING && now[0] <= before[0]) return [problem(system, `${row.Version} is breaking, yet raises no major version`)];
    if (compare(now.slice(0, 2), before.slice(0, 2)) <= 0) return [problem(system, `${row.Version} raises neither major nor minor`)];
    return [];
  });
}

function taskProblems(project) {
  return versioned(project).flatMap((record) =>
    rowsOf(record).flatMap((row) =>
      (isSystem(record) ? taskList(row.Task) : [row.Task])
        .filter((task) => !task?.startsWith(TASKS_DIR))
        .map((task) => problem(record, `task "${task ?? ""}" in version ${row.Version} must be a task folder, ${TASKS_DIR}…`))
    )
  );
}

function deprecationProblems(project) {
  return versioned(project)
    .filter((record) => isElement(record) && fm(record).status === "deprecated")
    .filter((record) => rowsOf(record).length && rowsOf(record).at(-1).Breaking !== BREAKING)
    .map((record) => problem(record, "deprecated, yet its last history row is not breaking"));
}

const RULES = {
  H1: presenceProblems,
  H2: duplicateProblems,
  H3: currentProblems,
  H4: breakingProblems,
  H5: publicationProblems,
  H6: deprecationProblems,
  H7: taskProblems,
};

/** Every broken history rule, in rule order. */
const check = checkOf(RULES);

module.exports = { check };
