// R1 to R16: the shape of each record and how records point at one another.
const fs = require("node:fs");
const path = require("node:path");
const { list, table } = require("./markdown.cjs");

const STATUSES = ["proposed", "validated", "coded", "deprecated"];
const DESIGN_STATUSES = ["proposed", "validated"]; // R16: system, brand and reviews are never coded
const YES_NO = ["yes", "no"];
const ASSET_TYPES = ["icon", "image", "illustration"];
const VERDICTS = ["ok", "ko", "pending"];
const NO_REPLACEMENT = "none";
const DEFAULT_STATE = "default";
const INTERACTIVE_STATES = ["hover", "focus", "disabled"];
const KEYBOARD_SECTION = "Keyboard";
const DEPRECATION_SECTION = "Deprecation";
const STEPS_SECTION = "Steps";
const VERDICTS_SECTION = "Verdicts";
const BRAND_HEADINGS = ["Project", "Users", "Domain", "Platforms", "Personality and tone", "References", "Anti-references"];
const SYSTEM_ID = "system";

const COMMON_KEYS = ["id", "kind", "status", "version"];
const COMPONENT_KEYS = ["uses", "tokens", "variants", "states", "interactive", "role"];
const KIND_KEYS = {
  system: ["platforms", "breakpoints", "themes", "locales", "directions", "code-roots", "ignore", "libraries"],
  brand: [],
  atom: COMPONENT_KEYS,
  molecule: COMPONENT_KEYS,
  composition: COMPONENT_KEYS,
  screen: ["uses", "states", "breakpoints", "route"],
  journey: ["persona"],
  asset: ["type", "file", "alt"],
  review: ["scope", "screens"],
};
const FOLDER_KINDS = {
  "": ["system", "brand"],
  components: ["atom", "molecule", "composition"],
  screens: ["screen"],
  journeys: ["journey"],
  assets: ["asset"],
  reviews: ["review"],
};
const COMPONENT_KINDS = FOLDER_KINDS.components;
const DESIGN_KINDS = ["system", "brand", "review"];
const LEVELS = { asset: 0, atom: 1, molecule: 2, composition: 3, screen: 4 }; // an element uses only lower levels

const INTEGER_VERSION = /^[1-9]\d*$/;
const SEMVER = /^\d+\.\d+\.\d+$/;

const listWithOr = (values) => `${values.slice(0, -1).join(", ")} or ${values.at(-1)}`;
const problem = (record, message) => ({ file: record.file, message });
const fm = (record) => record.frontMatter;
const isElement = (record) => fm(record).kind in LEVELS;
const isComponent = (record) => COMPONENT_KINDS.includes(fm(record).kind);
const isDeprecated = (record) => fm(record).status === "deprecated";
const folderLabel = (folder) => (folder ? `${folder}/` : "aidd_docs/ui/");

/** The records the other rules can read: a file without front matter is R1's alone. */
const readable = (project) => project.records.filter((record) => record.hasFrontMatter);

/** Readable records whose kind is known and in its folder: kind rules read only those. */
const placed = (project) => readable(project).filter((record) => FOLDER_KINDS[record.folder]?.includes(fm(record).kind));

/** The first record holding each id, in load order. */
function byId(project) {
  const index = new Map();
  for (const record of readable(project)) if (fm(record).id && !index.has(fm(record).id)) index.set(fm(record).id, record);
  return index;
}

const systemOf = (project) => readable(project).find((record) => fm(record).kind === SYSTEM_ID);

function frontMatterProblems(project) {
  return project.records.flatMap((record) => record.problems.map((parse) => problem(record, `line ${parse.line}: ${parse.message}`)));
}

function kindProblems(project) {
  return readable(project).flatMap((record) => {
    const kind = fm(record).kind;
    if (kind === undefined) return [];
    if (!(kind in KIND_KEYS)) return [problem(record, `unknown kind "${kind}"`)];
    if (FOLDER_KINDS[record.folder]?.includes(kind)) return [];
    return [problem(record, `kind "${kind}" does not belong in ${folderLabel(record.folder)}`)];
  });
}

function valueProblems(record) {
  const { status, interactive, type, kind } = fm(record);
  return [
    ...(status !== undefined && !STATUSES.includes(status) ? [`status "${status}" must be ${listWithOr(STATUSES)}`] : []),
    ...(COMPONENT_KINDS.includes(kind) && interactive !== undefined && !YES_NO.includes(interactive) ? [`interactive "${interactive}" must be ${listWithOr(YES_NO)}`] : []),
    ...(kind === "asset" && type !== undefined && !ASSET_TYPES.includes(type) ? [`type "${type}" must be ${listWithOr(ASSET_TYPES)}`] : []),
  ].map((message) => problem(record, message));
}

function requiredKeyProblems(project) {
  const placedRecords = new Set(placed(project));
  return readable(project).flatMap((record) => {
    const keys = [...COMMON_KEYS, ...(placedRecords.has(record) ? KIND_KEYS[fm(record).kind] : [])];
    const missing = keys.filter((key) => !(key in fm(record))).map((key) => problem(record, `missing key "${key}"`));
    return [...missing, ...(placedRecords.has(record) ? valueProblems(record) : [])];
  });
}

function identityProblems(project) {
  const index = byId(project);
  return readable(project).flatMap((record) => {
    const id = fm(record).id;
    if (id === undefined) return [];
    if (id !== record.name) return [problem(record, `id "${id}" differs from the file name "${record.name}"`)];
    const owner = index.get(id);
    return owner === record ? [] : [problem(record, `id "${id}" already belongs to ${owner.file}`)];
  });
}

function versionProblems(project) {
  return placed(project).flatMap((record) => {
    const version = fm(record).version;
    if (version === undefined) return [];
    if (fm(record).kind === SYSTEM_ID) return SEMVER.test(version) ? [] : [problem(record, `version "${version}" must be semver, such as 2.0.0`)];
    return INTEGER_VERSION.test(version) ? [] : [problem(record, `version "${version}" must be an integer from 1`)];
  });
}

function usesProblems(project) {
  const index = byId(project);
  return placed(project)
    .filter(isElement)
    .flatMap((record) =>
      list(fm(record).uses).flatMap((id) => {
        const used = index.get(id);
        if (!used) return [problem(record, `uses "${id}", which no record has`)];
        const kind = fm(record).kind;
        const usedKind = fm(used).kind;
        return LEVELS[usedKind] < LEVELS[kind] ? [] : [problem(record, `${kind} cannot use ${usedKind} "${id}"`)];
      })
    );
}

function stateProblems(project) {
  return placed(project).flatMap((record) => {
    const states = list(fm(record).states);
    if (fm(record).kind === "screen") return states.includes(DEFAULT_STATE) ? [] : [problem(record, `screen lacks state "${DEFAULT_STATE}"`)];
    if (!isComponent(record)) return [];
    const interactive = fm(record).interactive === "yes";
    return [
      ...(states.includes(DEFAULT_STATE) ? [] : [`component lacks state "${DEFAULT_STATE}"`]),
      ...(interactive ? INTERACTIVE_STATES.filter((state) => !states.includes(state)).map((state) => `interactive component lacks state "${state}"`) : []),
      ...(interactive && !(KEYBOARD_SECTION in record.sections) ? [`interactive component lacks a "## ${KEYBOARD_SECTION}" section`] : []),
    ].map((message) => problem(record, message));
  });
}

function codedProblems(project) {
  return placed(project)
    .filter((record) => isElement(record) && fm(record).status === "coded" && !("code" in fm(record)))
    .map((record) => problem(record, 'status coded needs "code"'));
}

function deprecatedProblems(project) {
  const index = byId(project);
  return placed(project)
    .filter((record) => isElement(record) && isDeprecated(record))
    .flatMap((record) => {
      const replacement = fm(record)["replaced-by"];
      if (replacement === undefined) return [problem(record, 'status deprecated needs "replaced-by"')];
      if (replacement === NO_REPLACEMENT) {
        return DEPRECATION_SECTION in record.sections ? [] : [problem(record, `replaced-by none needs a "## ${DEPRECATION_SECTION}" section saying why`)];
      }
      const target = index.get(replacement);
      if (!target) return [problem(record, `replaced-by "${replacement}", which no record has`)];
      return isDeprecated(target) ? [problem(record, `replaced-by "${replacement}" is deprecated too`)] : [];
    });
}

function deprecatedUseProblems(project) {
  const index = byId(project);
  return placed(project)
    .filter((record) => isElement(record) && !isDeprecated(record))
    .flatMap((record) =>
      list(fm(record).uses)
        .filter((id) => index.get(id) && isDeprecated(index.get(id)))
        .map((id) => problem(record, `uses "${id}", which is deprecated`))
    );
}

function breakpointProblems(project) {
  const system = systemOf(project);
  if (!system) return [];
  const declared = list(fm(system).breakpoints);
  return placed(project)
    .filter((record) => fm(record).kind === "screen")
    .flatMap((record) =>
      list(fm(record).breakpoints)
        .filter((breakpoint) => !declared.includes(breakpoint))
        .map((breakpoint) => problem(record, `breakpoint "${breakpoint}" is not in system.md`))
    );
}

const screenIds = (project) => new Set(placed(project).filter((record) => fm(record).kind === "screen").map((record) => fm(record).id));

function journeyProblems(project) {
  const screens = screenIds(project);
  return placed(project)
    .filter((record) => fm(record).kind === "journey")
    .flatMap((record) =>
      table(record.sections[STEPS_SECTION]).flatMap((row, index) =>
        screens.has(row.Screen) ? [] : [problem(record, `step ${index + 1} names screen "${row.Screen}", which no screen has`)]
      )
    );
}

function reviewProblems(project) {
  const index = byId(project);
  return placed(project)
    .filter((record) => fm(record).kind === "review")
    .flatMap((record) => {
      const rows = table(record.sections[VERDICTS_SECTION]);
      const missing = list(fm(record).screens).flatMap((id) =>
        list(index.get(id) && fm(index.get(id)).states)
          .filter((state) => !rows.some((row) => row.Screen === id && row.State === state))
          .map((state) => `no verdict row for ${id} / ${state}`)
      );
      const verdicts = rows
        .filter((row) => !VERDICTS.includes(row.Verdict))
        .map((row) => `verdict "${row.Verdict}" for ${row.Screen} / ${row.State} must be ${listWithOr(VERDICTS)}`);
      return [...missing, ...verdicts].map((message) => problem(record, message));
    });
}

function brandProblems(project) {
  return placed(project)
    .filter((record) => fm(record).kind === "brand")
    .flatMap((record) => BRAND_HEADINGS.filter((heading) => !(heading in record.sections)).map((heading) => problem(record, `lacks "## ${heading}"`)));
}

function assetProblems(project) {
  return placed(project)
    .filter((record) => fm(record).kind === "asset" && typeof fm(record).file === "string")
    .filter((record) => !fs.existsSync(path.join(project.root, path.dirname(record.file), fm(record).file)))
    .map((record) => problem(record, `file "${fm(record).file}" does not exist beside it`));
}

function designStatusProblems(project) {
  return placed(project)
    .filter((record) => DESIGN_KINDS.includes(fm(record).kind))
    .filter((record) => STATUSES.includes(fm(record).status) && !DESIGN_STATUSES.includes(fm(record).status))
    .map((record) => problem(record, `status "${fm(record).status}" is for elements: system, brand and reviews are ${listWithOr(DESIGN_STATUSES)}`));
}

const RULES = [
  frontMatterProblems, // R1
  kindProblems, // R2
  requiredKeyProblems, // R3
  identityProblems, // R4
  versionProblems, // R5
  usesProblems, // R6
  stateProblems, // R7
  codedProblems, // R8
  deprecatedProblems, // R9
  deprecatedUseProblems, // R10
  breakpointProblems, // R11
  journeyProblems, // R12
  reviewProblems, // R13
  brandProblems, // R14
  assetProblems, // R15
  designStatusProblems, // R16
];

/** Every broken record rule, as `{file, message}`, in rule order. */
const check = (project) => RULES.flatMap((rule) => rule(project));

module.exports = { check, readable, placed, byId, systemOf, isElement };
