// H1 to H8: each versioned record's history, the system version its publications raise, the task
// folder each change names, and a held element that changed, or a validated one whose token changed
// value, without a new version. A git that fails only warns: a slow machine must not block a turn.
const fs = require("node:fs");
const nodePath = require("node:path");
const { table, list, parseRecord } = require("./markdown.cjs");
const { placed, systemOf, byId, tokensUsedBy, isElement, isSystem, problem, fm, INTEGER_VERSION, SEMVER } = require("./model.cjs");
const { checkOf, text, UI_DIR, WARNING } = require("./project.cjs");
const { committed, baseline, changed } = require("./committed.cjs");
const { cssFileOf, cssNameOf } = require("./tokens.cjs");
const { renderOf } = require("./renders.cjs");

const HISTORY_SECTION = "History";
const BREAKING_VALUES = ["yes", "no"];
const BREAKING = "yes";
const TASKS_DIR = "aidd_docs/tasks/";
const VALIDATED = "validated";
const HELD_STATUSES = [VALIDATED, "deprecated"]; // a proposed element is still being designed
const UNVERSIONED_KEYS = ["status", "implemented-version", "code"]; // a review, a code catch-up: no new version
const FRONT_MATTER_FENCE = "---";
const SECTION_PREFIX = "## ";
const LINE_BREAK = "\n";

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

/** A record's text without what a version never covers: the status, the implementation link and
 * the History section. */
function substance(content) {
  const lines = content.split(LINE_BREAK);
  const close = lines.findIndex((line, index) => index > 0 && line.trimEnd() === FRONT_MATTER_FENCE);
  let inHistory = false;
  return lines
    .filter((line, index) => {
      if (index <= close) return !UNVERSIONED_KEYS.some((key) => line.startsWith(`${key}:`));
      if (line.startsWith(SECTION_PREFIX)) inHistory = line.trim() === `${SECTION_PREFIX}${HISTORY_SECTION}`;
      return !inHistory;
    })
    .join(LINE_BREAK);
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
  return versioned(project)
    .filter(isElement)
    .flatMap((record) => {
      const touched = [record.file, renderOf(record)].some((file) => changed(project).has(file));
      const before = touched ? baseline(project, record.file) : null;
      const was = before === null ? null : heldFront(record, before);
      if (was === null) return [];
      const edited = substance(text(project, record.file)) !== substance(before) || renderChanged(project, record);
      return edited ? [problem(record, `edited since its committed version ${was.version}, raise its version with a History row`)] : [];
    });
}

const BASE_KEY = "";
const MEDIA_PREFIX = "@media ";
const COMMENT = /\/\*[\s\S]*?\*\//g;
const RULE_BLOCK = /(?:@media\s+([^{}]+?)\s*\{)?([^{}]+)\{([^{}]*)\}/g; // a breakpoint's rule holds its query
const DECLARATION = /(--[\w-]+)\s*:\s*([^;]+);/g;
const VAR_CALL = /var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g;

/** A generated stylesheet's custom properties by selector: the base, `:root`, under BASE_KEY, and
 * a breakpoint under its query, its rule sharing the base's selector. */
function declarationsOf(css) {
  const found = new Map();
  for (const [, media, selector, body] of css.replace(COMMENT, "").matchAll(RULE_BLOCK)) {
    const key = media ? `${MEDIA_PREFIX}${media}` : selector.includes(":root") ? BASE_KEY : selector.trim();
    const own = found.get(key) ?? new Map();
    for (const [, name, value] of body.matchAll(DECLARATION)) own.set(name, value.trim());
    found.set(key, own);
  }
  return found;
}

/** A custom property's value with each `var()` it holds replaced by its target's, down to a value. */
function resolved(values, name, path = new Set()) {
  const value = values.get(name);
  if (value === undefined || path.has(name)) return value;
  return value.replace(VAR_CALL, (call, target) => resolved(values, target, new Set([...path, name])) ?? call);
}

/** The custom properties whose resolved value differs between two stylesheets, in a theme both
 * hold, or at a breakpoint either holds, since a width without one reads the base. */
function changedProperties(before, after) {
  const changed = new Set();
  const compared = [...new Set([...before.keys(), ...after.keys()])].filter((key) => key.startsWith(MEDIA_PREFIX) || (before.has(key) && after.has(key)));
  for (const key of compared) {
    const within = (sheet) => new Map([...(sheet.get(BASE_KEY) ?? []), ...(sheet.get(key) ?? [])]);
    const [was, now] = [within(before), within(after)];
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
  return versioned(project)
    .filter((record) => isElement(record) && !named.has(record.file))
    .flatMap((record) => {
      const tokens = tokensUsedBy(index, record).filter((token) => moved.has(cssNameOf(token)));
      const committedRecord = tokens.length ? baseline(project, record.file) : null;
      const was = committedRecord === null ? null : heldFront(record, committedRecord);
      return was?.status !== VALIDATED ? [] : [problem(record, `value of ${tokens.join(", ")} changed since its committed version ${was.version}, raise its version with a History row`)];
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

module.exports = { check };
