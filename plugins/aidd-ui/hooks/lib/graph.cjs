// Which files a write reaches: the written files, the record each belongs to with its render,
// and every record citing that one. The feedback after a write names what it broke elsewhere
// without repeating the whole design system.
const { list, table } = require("./markdown.cjs");
const { placed, fm } = require("./records.cjs");
const { renderOf } = require("./renders.cjs");
const { codeOwner } = require("./code.cjs");
const { isUnder, UI_DIR } = require("./project.cjs");

// Files every record reads: a write to one reaches the whole design system.
const SHARED_FILES = ["system.md", "tokens.json", "tokens.resolver.json"].map((name) => `${UI_DIR}/${name}`);
const SHARED_DIRS = [`${UI_DIR}/themes`];
const STEPS_SECTION = "Steps";

const isShared = (file) => SHARED_FILES.includes(file) || SHARED_DIRS.some((dir) => isUnder(file, dir));

/** The ids a record cites: what it uses, what replaces it, the screens a review or journey names. */
const cited = (record) => [
  ...list(fm(record).uses),
  ...list(fm(record)["replaced-by"]),
  ...(fm(record).kind === "review" ? list(fm(record).screens) : []),
  ...table(record.sections[STEPS_SECTION]).map((row) => row.Screen),
];

/** The record a written file belongs to: the record itself, its render, or the code it links. */
const ownerOf = (project, records, file) => records.find((record) => record.file === file || renderOf(record) === file) ?? codeOwner(project, file);

/** The files a write of `written`, project-relative, reaches; null when it reaches them all. */
function reached(project, written) {
  if (written.some(isShared)) return null;
  const records = placed(project);
  const files = new Set(written);
  for (const owner of written.map((file) => ownerOf(project, records, file)).filter(Boolean)) {
    files.add(owner.file);
    files.add(renderOf(owner));
    for (const record of records) if (cited(record).includes(fm(owner).id)) files.add(record.file);
  }
  return files;
}

module.exports = { reached };
