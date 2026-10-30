// H1 to H6: each versioned record's history, and the system version its tasks raise.
const { table } = require("./markdown.cjs");
const { placed, systemOf, isElement } = require("./records.cjs");

const HISTORY_SECTION = "History";
const BREAKING_VALUES = ["yes", "no"];
const BREAKING = "yes";
const SYSTEM_KIND = "system";

const INTEGER_VERSION = /^[1-9]\d*$/;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

const problem = (record, message) => ({ file: record.file, message });
const fm = (record) => record.frontMatter;
const isSystem = (record) => fm(record).kind === SYSTEM_KIND;
const rowsOf = (record) => table(record.sections[HISTORY_SECTION]);

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
    const rows = rowsOf(record)
      .map((row) => ({ version: row.Version, parts: parts(row.Version, system) }))
      .filter((row) => row.parts)
      .sort((a, b) => compare(a.parts, b.parts));
    if (!current || !rows.length) return [];
    const highest = rows.at(-1);
    const problems = compare(current, highest.parts) === 0 ? [] : [`version ${fm(record).version} is not the highest history row, ${highest.version}`];
    if (!system) {
      for (let index = 1; index < rows.length; index += 1) {
        const step = rows[index].parts[0] - rows[index - 1].parts[0];
        if (step > 1) problems.push(`history jumps from ${rows[index - 1].version} to ${rows[index].version}`);
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

/** For each element task, whether any of its rows breaks, and which records it touches. */
function elementTasks(project) {
  const tasks = new Map();
  for (const record of versioned(project).filter((candidate) => !isSystem(candidate))) {
    for (const row of rowsOf(record)) {
      const task = tasks.get(row.Task) ?? { breaking: false, records: [] };
      task.breaking ||= row.Breaking === BREAKING;
      if (!task.records.includes(record)) task.records.push(record);
      tasks.set(row.Task, task);
    }
  }
  return tasks;
}

/** The system row a task raised, with the row before it; null when the task has none. */
function systemRow(rows, task) {
  const index = rows.findIndex((row) => row.Task === task);
  return index < 0 ? null : { row: rows[index], previous: rows[index - 1] };
}

function bumpProblems(project) {
  const system = systemOf(project);
  const rows = system ? rowsOf(system) : [];
  return [...elementTasks(project)].flatMap(([task, { breaking, records }]) => {
    const found = systemRow(rows, task);
    if (!found) return records.map((record) => problem(record, `task "${task}" has no row in system.md`));
    if (!found.previous) return [];
    const now = parts(found.row.Version, true);
    const before = parts(found.previous.Version, true);
    if (!now || !before) return [];
    if (breaking && now[0] <= before[0]) {
      return [problem(system, `task "${task}" breaks an element, yet system.md ${found.row.Version} raises no major version`)];
    }
    if (!breaking && compare(now.slice(0, 2), before.slice(0, 2)) <= 0) {
      return [problem(system, `task "${task}" changes an element, yet system.md ${found.row.Version} raises neither major nor minor`)];
    }
    return [];
  });
}

function deprecationProblems(project) {
  return versioned(project)
    .filter((record) => isElement(record) && fm(record).status === "deprecated")
    .filter((record) => rowsOf(record).length && rowsOf(record).at(-1).Breaking !== BREAKING)
    .map((record) => problem(record, "deprecated, yet its last history row is not breaking"));
}

const RULES = [
  presenceProblems, // H1
  duplicateProblems, // H2
  currentProblems, // H3
  breakingProblems, // H4
  bumpProblems, // H5
  deprecationProblems, // H6
];

/** Every broken history rule, as `{file, message}`, in rule order. */
const check = (project) => RULES.flatMap((rule) => rule(project));

module.exports = { check };
