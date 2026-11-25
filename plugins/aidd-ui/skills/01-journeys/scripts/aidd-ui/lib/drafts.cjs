// Sets of variants: a skill writes one under aidd_docs/ui/drafts/<set>/, `showcase` checks it, `keep` makes one variant the design system's own.
const fs = require("node:fs");
const path = require("node:path");
const { Refusal, NO_UI_FOLDER, walk, clean, relative, UI_DIR, DRAFTS_DIR, CHOICES_FILE, ERROR } = require("./project.cjs");
const { table, frontMatterEnd, LINE_BREAK } = require("./markdown.cjs");
const { fingerprintOf } = require("./html.cjs");
const { loadsStylesheet, STYLESHEET_HREF } = require("./renders.cjs");

const VARIANTS_FILE = "variants.md";
const PREVIEW_FILE = "preview.html"; // a variant's own look, shown while choosing and never kept
const IGNORE_FILE = ".gitignore";
const IGNORE_ALL = "*\n";
const CHOICES_HEADER = `# Choices${LINE_BREAK}${LINE_BREAK}| Set | Kept | Set aside | Intent |${LINE_BREAK}| --- | --- | --- | --- |${LINE_BREAK}`;
const VARIANT_COLUMN = "Variant";
const INTENT_COLUMN = "Intent";
const ROUND_COLUMN = "Round"; // the round a variant belongs to, 1 when the column is absent
const PARENT_COLUMN = "Parent"; // the variant of an earlier round a variant is drawn from
// A set's name is a folder of its own, never a path out of the drafts.
const SET_NAME = /^[a-z0-9][a-z0-9-]*$/;
const WHITESPACE = /\s+/g;
const SHOWN_FILE = /\.(?:md|html)$/; // the page shows records and renders; anything else only counts in the check

/** The set `id` of the project under `root`, its `variants.md` read: `rows` keyed by column, `axes` the columns after the intent. */
function setOf(root, id) {
  if (!SET_NAME.test(id)) throw new Refusal(`"${id}" is no set name, use lowercase letters, digits and hyphens`);
  if (!fs.existsSync(path.join(root, UI_DIR))) throw new Refusal(NO_UI_FOLDER);
  const dir = path.join(root, UI_DIR, DRAFTS_DIR, id);
  const file = `${UI_DIR}/${DRAFTS_DIR}/${id}/${VARIANTS_FILE}`;
  if (!fs.existsSync(path.join(root, file))) throw new Refusal(`no ${file}. Write it, then run showcase.`);
  const rows = table({ lines: clean(fs.readFileSync(path.join(root, file), "utf8")).split(LINE_BREAK) });
  const axes = rows.length ? Object.keys(rows[0]).filter((column) => ![VARIANT_COLUMN, INTENT_COLUMN, ROUND_COLUMN, PARENT_COLUMN].includes(column)) : [];
  return { id, dir, file, rows, axes };
}

/** What a cell says, with its case and spacing set aside. */
const valueOf = (cell) => (cell ?? "").toLowerCase().replace(WHITESPACE, " ").trim();

/** A variant name is a folder name of its own, as a set's is. */
const isName = (name) => typeof name === "string" && SET_NAME.test(name);

/** The renders of a variant that load the tokens from another path than the record they become. */
const strayRenders = (from) =>
  walk(from)
    .map((file) => relative(from, file))
    .filter((file) => file.endsWith(".html") && path.basename(file) !== PREVIEW_FILE && !loadsStylesheet(fs.readFileSync(path.join(from, file), "utf8")));

/** The problems of a set, D1 to D6, each naming its variant. */
function check({ dir, file, rows, axes }) {
  const found = [];
  const flag = (rule, message, fix, excerpt) => found.push({ rule, severity: ERROR, file, message, fix, ...(excerpt === undefined ? {} : { excerpt }) });
  const names = rows.map((row) => row[VARIANT_COLUMN]);
  if (rows.length < 2) flag("D1", "a set needs two variants to compare", `add a row to ${VARIANTS_FILE}`);
  if (!axes.length) flag("D3", `${VARIANTS_FILE} has no axis column`, "add one column per axis the variants differ on");
  rows.forEach((row, at) => {
    if (!row[INTENT_COLUMN]) flag("D2", `variant "${names[at]}" has no intent`, "write the intent it serves", names[at]);
    for (const axis of axes) if (!row[axis]) flag("D3", `variant "${names[at]}" has no value for ${axis}`, `write its ${axis}`, names[at]);
    if (!isName(names[at])) flag("D5", `variant "${names[at]}" is no folder name`, "name it with lowercase letters, digits and hyphens", String(names[at]));
    else if (!walk(path.join(dir, names[at])).length) flag("D5", `variant "${names[at]}" has no files`, `write its files in ${DRAFTS_DIR}/${path.basename(dir)}/${names[at]}/`, names[at]);
    else for (const render of strayRenders(path.join(dir, names[at]))) flag("D6", `${names[at]}/${render} does not load ${STYLESHEET_HREF}, as its record will`, `link ${STYLESHEET_HREF}, the path from aidd_docs/ui/`, `${names[at]}/${render}`);
  });
  rows.forEach((row, at) => {
    rows.slice(at + 1).forEach((other, offset) => {
      const pair = `${names[at]}, ${names[at + 1 + offset]}`;
      if (axes.length && axes.every((axis) => valueOf(row[axis]) === valueOf(other[axis]))) flag("D4", `variants "${pair}" share every axis value`, "make them differ on an axis, or drop one", pair);
    });
  });
  return found;
}

/** The round of a row, and the variant it is drawn from or null. */
const roundOf = (row) => ({ round: Number.parseInt(row[ROUND_COLUMN], 10) || 1, parent: row[PARENT_COLUMN] || null });

/** What the page shows of a variant: its row, and its records and renders as text. */
function shownOf({ dir, axes }, row) {
  const from = path.join(dir, row[VARIANT_COLUMN]);
  const files = walk(from)
    .map((file) => relative(from, file))
    .filter((file) => SHOWN_FILE.test(file))
    .map((file) => ({ path: file, text: fs.readFileSync(path.join(from, file), "utf8") }));
  return { name: row[VARIANT_COLUMN], intent: row[INTENT_COLUMN], ...roundOf(row), axes: axes.map((axis) => [axis, row[axis]]), files };
}

/** Every set under the drafts: its rows and axes, what each variant shows, its problems and a fingerprint of what it shows.
 * A variant named like a path shows no files, and a folder without `variants.md` is no set. */
function setsOf(root) {
  const draftsDir = path.join(root, UI_DIR, DRAFTS_DIR);
  if (!fs.existsSync(draftsDir)) return [];
  return fs
    .readdirSync(draftsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && SET_NAME.test(entry.name) && fs.existsSync(path.join(draftsDir, entry.name, VARIANTS_FILE)))
    .map((entry) => entry.name)
    .sort()
    .map((id) => {
      const set = setOf(root, id);
      const variants = set.rows.map((row) => (isName(row[VARIANT_COLUMN]) ? shownOf(set, row) : { name: row[VARIANT_COLUMN], intent: row[INTENT_COLUMN], ...roundOf(row), axes: set.axes.map((axis) => [axis, row[axis]]), files: [] }));
      return { id, rows: set.rows, axes: set.axes, variants, problems: check(set), fingerprint: fingerprintOf(variants) };
    });
}

/** The index of the `version:` line of the front matter of `lines`, -1 when there is none. */
const versionLineOf = (lines) => {
  const close = frontMatterEnd(lines);
  return close < 0 ? -1 : lines.findIndex((line, index) => index > 0 && index < close && line.startsWith("version:"));
};

/** A variant's record as text, with the `version:` line of the record it replaces: a version is the design system's, not a variant's. */
function withVersionOf(variantText, existingText) {
  const lines = variantText.split(LINE_BREAK);
  const [at, kept] = [versionLineOf(lines), versionLineOf(existingText.split(LINE_BREAK))];
  if (at < 0 || kept < 0) return variantText;
  const existing = existingText.split(LINE_BREAK)[kept].replace(/\r$/, "");
  lines[at] = existing + (lines[at].endsWith("\r") ? "\r" : "");
  return lines.join(LINE_BREAK);
}

/** Adds to choices.md a row for each variant of the set but `kept`, every round included: what was set aside, and what it aimed at.
 * A cell read from variants.md holds no "|" nor line break, so it is written as read. */
function recordChoice(root, { id, rows }, kept) {
  const file = path.join(root, CHOICES_FILE);
  const rowsOf = rows.filter((row) => row[VARIANT_COLUMN] !== kept).map((row) => `| ${id} | ${kept} | ${row[VARIANT_COLUMN]} | ${row[INTENT_COLUMN]} |${LINE_BREAK}`);
  const fd = fs.openSync(file, "a");
  try {
    fs.writeSync(fd, `${fs.fstatSync(fd).size ? "" : CHOICES_HEADER}${rowsOf.join("")}`);
  } finally {
    fs.closeSync(fd);
  }
}

/** The file's text, or null when it does not exist. */
function contentOf(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

/** Copies the variant's folder into the design system, `preview.html` aside, records the variants set aside, then deletes the set. A record replaced keeps its version. */
function keep(root, id, variant) {
  const set = setOf(root, id);
  const problems = check(set);
  if (problems.length) throw new Refusal(`${id} has problems (${[...new Set(problems.map((problem) => problem.rule))].join(", ")}). Fix them, then run showcase.`);
  if (!set.rows.some((row) => row[VARIANT_COLUMN] === variant)) throw new Refusal(`no variant "${variant}" in ${id}`);
  const from = path.join(set.dir, variant);
  const written = walk(from)
    .map((file) => relative(from, file))
    .filter((file) => file !== PREVIEW_FILE)
    .map((file) => {
      const target = path.join(root, UI_DIR, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const replaced = file.endsWith(".md") ? contentOf(target) : null;
      if (replaced !== null) fs.writeFileSync(target, withVersionOf(fs.readFileSync(path.join(from, file), "utf8"), replaced));
      else fs.copyFileSync(path.join(from, file), target);
      return `${UI_DIR}/${file}`;
    });
  recordChoice(root, set, variant);
  fs.rmSync(set.dir, { recursive: true });
  return { kept: variant, written };
}

module.exports = { keep, setsOf, IGNORE_FILE, IGNORE_ALL };
