// The record model every check reads: which kinds exist, where each lives, and the records a
// rule can trust.
const SYSTEM_ID = "system";
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

const INTEGER_VERSION = /^[1-9]\d*$/;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

const problem = (record, message) => ({ file: record.file, message });
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

const systemOf = (project) => readable(project).find((record) => fm(record).kind === SYSTEM_ID);
const isSystem = (record) => fm(record).kind === SYSTEM_ID;

module.exports = { FOLDER_KINDS, COMPONENT_KINDS, IMPLEMENTED_KINDS, TOKENED_KINDS, LEVELS, INTEGER_VERSION, SEMVER, problem, fm, isElement, isComponent, isSystem, belongs, readable, placed, byId, systemOf };
