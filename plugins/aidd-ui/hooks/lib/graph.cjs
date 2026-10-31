// What a change reaches. After a write: the written files, the record each belongs to with its
// render, and every record citing that one, so the feedback names what it broke elsewhere
// without repeating the whole design system. Before a change: the tokens, elements, screens,
// journeys, renders and code files that depend on the tokens or elements it touches.
const { list, table } = require("./markdown.cjs");
const { placed, fm, COMPONENT_KINDS } = require("./model.cjs");
const { renderOf } = require("./renders.cjs");
const { codeOwner, codeFileOf } = require("./code.cjs");
const { citations } = require("./tokens.cjs");
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

const REPORT_KINDS = { elements: [...COMPONENT_KINDS, "asset"], screens: ["screen"], journeys: ["journey"] };

/** `seed` grown with each candidate that cites a member, until none more joins. */
function closure(seed, candidates, keyOf, citesOf) {
  const found = new Set(seed);
  let grew = true;
  while (grew) {
    grew = false;
    for (const candidate of candidates) {
      if (found.has(keyOf(candidate)) || !citesOf(candidate).some((cited) => found.has(cited))) continue;
      found.add(keyOf(candidate));
      grew = true;
    }
  }
  return found;
}

/** What a change to `refs`, token names and record ids, reaches, each list sorted; `unknown` names
 * the refs that are neither. A ref is reached itself. */
function usages(project, refs) {
  const cites = citations(project);
  const records = placed(project).filter((record) => fm(record).id);
  const isRecord = (ref) => records.some((record) => fm(record).id === ref);
  const unknown = refs.filter((ref) => !cites.has(ref) && !isRecord(ref));
  if (unknown.length) return { unknown };
  const tokens = closure(refs.filter((ref) => cites.has(ref)), [...cites], ([name]) => name, ([, cited]) => cited);
  const declaring = records.filter((record) => list(fm(record).tokens).some((token) => tokens.has(token)));
  const ids = closure([...refs.filter(isRecord), ...declaring.map((record) => fm(record).id)], records, (record) => fm(record).id, cited);
  const reachedRecords = records.filter((record) => ids.has(fm(record).id));
  const idsOf = (kinds) => reachedRecords.filter((record) => kinds.includes(fm(record).kind)).map((record) => fm(record).id).sort();
  return {
    tokens: [...tokens].sort(),
    ...Object.fromEntries(Object.entries(REPORT_KINDS).map(([key, kinds]) => [key, idsOf(kinds)])),
    renders: reachedRecords.map(renderOf).filter((file) => project.renders.includes(file)).sort(),
    code: [...new Set(reachedRecords.map((record) => codeFileOf(fm(record).code)).filter(Boolean))].sort(),
  };
}

module.exports = { reached, usages };
