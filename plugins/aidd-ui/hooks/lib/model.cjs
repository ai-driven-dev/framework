// The record model every check reads: which kinds exist, where each lives, and the records a
// rule can trust.
const { list, table } = require("./markdown.cjs");

const SYSTEM_ID = "system";
const STEPS_SECTION = "Steps";
const STATUS_DEPRECATED = "deprecated";
const BREAKING = "yes"; // a history row's Breaking cell
const NOT_BREAKING = "no";
const BREAKING_VALUES = [BREAKING, NOT_BREAKING];
const BREAKPOINTS_SECTION = "Breakpoints";
const FOLDER_KINDS = {
  "": ["system", "brand"],
  components: ["atom", "molecule", "composition"],
  screens: ["screen"],
  journeys: ["journey"],
  assets: ["asset"],
  reviews: ["review"],
};
const COMPONENT_KINDS = FOLDER_KINDS.components;
const IMPLEMENTED_KINDS = [...COMPONENT_KINDS, "screen"];
const TOKENED_KINDS = IMPLEMENTED_KINDS; // components and screens cite the tokens their render uses
const LEVELS = { asset: 0, atom: 1, molecule: 2, composition: 3, screen: 4 }; // an element uses its own level or lower

const VARIANT_AXIS = "variant"; // a bare item of `variants`, shown by data-variant
const AXIS_SEPARATOR = "=";

const INTEGER_VERSION = /^[1-9]\d*$/;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** A problem of a record: what is wrong (`message`), what clears it (`fix`), and the offending text when there is one (`excerpt`). */
const problem = (record, message, fix, excerpt) => ({ file: record.file, message, fix, ...(excerpt === undefined ? {} : { excerpt }) });
const fm = (record) => record.frontMatter;
const isElement = (record) => Object.hasOwn(LEVELS, fm(record).kind);
/** Whether `kind` belongs in `folder`: own keys only, so `constructor` names no folder. */
const belongs = (folder, kind) => Object.hasOwn(FOLDER_KINDS, folder) && FOLDER_KINDS[folder].includes(kind);
const isComponent = (record) => COMPONENT_KINDS.includes(fm(record).kind);

/** The records the other rules can read: a file without front matter is R1's alone. */
const readable = (project) => project.records.filter((record) => record.hasFrontMatter);

/** Readable records whose kind is known and in its folder: kind rules read only those. */
const placed = (project) => readable(project).filter((record) => belongs(record.folder, fm(record).kind));

/** The first record holding each id, in load order. */
function byId(project) {
  const index = new Map();
  for (const record of readable(project)) if (fm(record).id && !index.has(fm(record).id)) index.set(fm(record).id, record);
  return index;
}

/** The tokens a record declares, then those of every element it uses, transitively: what its render
 * may show, so what a token change reaches. */
function tokensUsedBy(index, record) {
  const seen = new Set();
  const visit = (each) => {
    if (seen.has(each)) return;
    seen.add(each);
    for (const id of list(fm(each).uses)) if (index.has(id)) visit(index.get(id));
  };
  visit(record);
  return [...new Set([...seen].flatMap((each) => list(fm(each).tokens)))];
}

/** A `variants` item as its axis and value: `axis=value`, or a bare value on the `variant` axis. */
function variantOf(item) {
  const at = item.indexOf(AXIS_SEPARATOR);
  return at < 0 ? { axis: VARIANT_AXIS, value: item } : { axis: item.slice(0, at), value: item.slice(at + 1) };
}

/** The rows of the system's `## Breakpoints` table, `Name` and `Query`: the only place breakpoints are declared. */
const breakpointRows = (system) => table(system?.sections[BREAKPOINTS_SECTION]);
const breakpointsOf = (system) => breakpointRows(system).map((row) => row.Name);

const systemOf = (project) => readable(project).find((record) => fm(record).kind === SYSTEM_ID);
const isSystem = (record) => fm(record).kind === SYSTEM_ID;

module.exports = { breakpointRows, breakpointsOf, SYSTEM_ID, STEPS_SECTION, STATUS_DEPRECATED, BREAKING, NOT_BREAKING, BREAKING_VALUES, AXIS_SEPARATOR, variantOf, COMPONENT_KINDS, IMPLEMENTED_KINDS, TOKENED_KINDS, LEVELS, INTEGER_VERSION, SEMVER, problem, fm, isElement, isComponent, isSystem, belongs, readable, placed, byId, systemOf, tokensUsedBy };
