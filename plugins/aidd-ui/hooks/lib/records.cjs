// R1 to R17: the shape of each record and how records point at one another.
const fs = require("node:fs");
const path = require("node:path");
const { list, table } = require("./markdown.cjs");
const { checkOf } = require("./project.cjs");

const STATUSES = ["proposed", "validated", "deprecated"];
const DESIGN_STATUSES = ["proposed", "validated"]; // R16: system, brand and reviews are never deprecated
const IMPLEMENTED_VERSION = "implemented-version"; // the version of an element its code implements
const FORMAT = "1"; // the record format this validator reads
const YES_NO = ["yes", "no"];
const ASSET_TYPES = ["icon", "image", "illustration"];
const VERDICTS = ["ok", "ko", "pending"];
const NO_REPLACEMENT = "none";
const DEFAULT_STATE = "default";
const INTERACTIVE_STATE = "focus"; // hover and disabled only when they exist
const KEYBOARD_SECTION = "Keyboard";
const USAGE_SECTION = "Usage";
const DEPRECATION_SECTION = "Deprecation";
const STEPS_SECTION = "Steps";
const VERDICTS_SECTION = "Verdicts";
const BRAND_HEADINGS = ["Project", "Users", "Domain", "Platforms", "Personality and tone", "References", "Anti-references"];
const SYSTEM_ID = "system";

const COMMON_KEYS = ["id", "kind", "status", "version"];
const COMPONENT_KEYS = ["uses", "tokens", "variants", "states", "interactive", "role"];
const KIND_KEYS = {
  system: ["format", "platforms", "breakpoints", "themes", "locales", "directions", "primitives", "code-roots", "ignore", "libraries"],
  brand: [],
  atom: COMPONENT_KEYS,
  molecule: COMPONENT_KEYS,
  composition: COMPONENT_KEYS,
  screen: ["uses", "tokens", "states", "breakpoints", "route"],
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
const ASSEMBLED_KINDS = ["molecule", "composition"]; // implemented through what they use when no file is their own
const IMPLEMENTED_KINDS = [...COMPONENT_KINDS, "screen"];
const TOKENED_KINDS = IMPLEMENTED_KINDS; // components and screens cite the tokens their render uses
const DESIGN_KINDS = ["system", "brand", "review"];
const LEVELS = { asset: 0, atom: 1, molecule: 2, composition: 3, screen: 4 }; // an element uses its own level or lower

const INTEGER_VERSION = /^[1-9]\d*$/;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

const listWithOr = (values) => `${values.slice(0, -1).join(", ")} or ${values.at(-1)}`;
const problem = (record, message) => ({ file: record.file, message });
const fm = (record) => record.frontMatter;
const isElement = (record) => Object.hasOwn(LEVELS, fm(record).kind);
/** Whether `kind` belongs in `folder`: own keys only, so `constructor` names no folder. */
const belongs = (folder, kind) => Object.hasOwn(FOLDER_KINDS, folder) && FOLDER_KINDS[folder].includes(kind);
const isComponent = (record) => COMPONENT_KINDS.includes(fm(record).kind);
const isDeprecated = (record) => fm(record).status === "deprecated";
const folderLabel = (folder) => (folder ? `${folder}/` : "aidd_docs/ui/");

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

function frontMatterProblems(project) {
  return project.records.flatMap((record) => record.problems.map((parse) => problem(record, `line ${parse.line}: ${parse.message}`)));
}

function kindProblems(project) {
  return readable(project).flatMap((record) => {
    const kind = fm(record).kind;
    if (kind === undefined) return [];
    if (!Object.hasOwn(KIND_KEYS, kind)) return [problem(record, `unknown kind "${kind}"`)];
    if (belongs(record.folder, kind)) return [];
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
        if (used === record) return [problem(record, "uses itself")];
        const kind = fm(record).kind;
        const usedKind = fm(used).kind;
        return LEVELS[usedKind] <= LEVELS[kind] ? [] : [problem(record, `${kind} cannot use ${usedKind} "${id}"`)];
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
      ...(interactive && !states.includes(INTERACTIVE_STATE) ? [`interactive component lacks state "${INTERACTIVE_STATE}"`] : []),
      ...(interactive && !(KEYBOARD_SECTION in record.sections) ? [`interactive component lacks a "## ${KEYBOARD_SECTION}" section`] : []),
    ].map((message) => problem(record, message));
  });
}

const isImplemented = (record) => IMPLEMENTED_VERSION in fm(record);

/** Whether an assembled element is implemented through the elements it uses: at least one, all
 * implemented. Assets are files, never code, so they count for nothing. */
function implementedThroughUses(record, index) {
  const used = list(fm(record).uses)
    .map((id) => index.get(id))
    .filter((target) => !target || fm(target).kind !== "asset");
  return ASSEMBLED_KINDS.includes(fm(record).kind) && used.length > 0 && used.every((target) => target && isImplemented(target));
}

/** What is wrong with an element's implemented version, or null. */
function implementedProblem(record, index) {
  const { kind, version } = fm(record);
  const implemented = fm(record)[IMPLEMENTED_VERSION];
  if (!IMPLEMENTED_KINDS.includes(kind)) return `${IMPLEMENTED_VERSION} is for components and screens, never a ${kind}`;
  if (!INTEGER_VERSION.test(implemented)) return `${IMPLEMENTED_VERSION} "${implemented}" must be an integer from 1`;
  if (INTEGER_VERSION.test(version) && Number(implemented) > Number(version)) return `${IMPLEMENTED_VERSION} ${implemented} is ahead of version ${version}`;
  if ("code" in fm(record) || implementedThroughUses(record, index)) return null;
  return ASSEMBLED_KINDS.includes(kind) ? `${IMPLEMENTED_VERSION} needs "code", or every element it uses implemented` : `${IMPLEMENTED_VERSION} needs "code"`;
}

function implementedProblems(project) {
  const index = byId(project);
  return placed(project)
    .filter(isImplemented)
    .flatMap((record) => {
      const message = implementedProblem(record, index);
      return message ? [problem(record, message)] : [];
    });
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
      // A verdict judges one version: a row for an older one leaves the current one unreviewed.
      const missing = list(fm(record).screens).flatMap((id) => {
        const screen = index.get(id);
        const version = screen && fm(screen).version;
        return list(screen && fm(screen).states)
          .filter((state) => !rows.some((row) => row.Screen === id && row.State === state && row.Version === version))
          .map((state) => `no verdict row for ${id} / ${state} at version ${version}`);
      });
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

function usageProblems(project) {
  return placed(project)
    .filter((record) => isComponent(record) && !(USAGE_SECTION in record.sections))
    .map((record) => problem(record, `lacks "## ${USAGE_SECTION}", saying when to use it and when not`));
}

/** The one problem a system.md written for another format earns, since every rule would misread
 * it; null when the format is this one or not stated, which R3 names. */
function formatProblem(project) {
  const system = systemOf(project);
  const format = system && fm(system).format;
  return format === undefined || format === FORMAT ? null : problem(system, `format "${format}" is not ${FORMAT}, the one this validator reads`);
}

const RULES = {
  R1: frontMatterProblems,
  R2: kindProblems,
  R3: requiredKeyProblems,
  R4: identityProblems,
  R5: versionProblems,
  R6: usesProblems,
  R7: stateProblems,
  R8: implementedProblems,
  R9: deprecatedProblems,
  R10: deprecatedUseProblems,
  R11: breakpointProblems,
  R12: journeyProblems,
  R13: reviewProblems,
  R14: brandProblems,
  R15: assetProblems,
  R16: designStatusProblems,
  R17: usageProblems,
};

/** Every broken record rule, in rule order. */
const check = checkOf(RULES);

module.exports = { check, formatProblem, placed, systemOf, isElement, fm, COMPONENT_KINDS, TOKENED_KINDS, INTEGER_VERSION, SEMVER };
