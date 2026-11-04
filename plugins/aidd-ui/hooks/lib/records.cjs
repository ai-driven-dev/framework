// R1 to R17: the shape of each record and how records point at one another.
const fs = require("node:fs");
const path = require("node:path");
const { list, table } = require("./markdown.cjs");
const { checkOf, HISTORY_FILE } = require("./project.cjs");
const { breakpointsOf, STEPS_SECTION, STATUS_DEPRECATED, SYSTEM_ID, AXIS_SEPARATOR, variantOf, IMPLEMENTED_KINDS, LEVELS, INTEGER_VERSION, SEMVER, problem, fm, isElement, isComponent, isSystem, belongs, readable, placed, byId, systemOf } = require("./model.cjs");

const STATUSES = ["proposed", "validated", STATUS_DEPRECATED];
const REVIEW_STATUSES = ["proposed", "validated"]; // R16: a review is never deprecated
const FORMAT = "1"; // the record format this validator reads
const ASSET_TYPES = ["icon", "image", "illustration"];
const VERDICTS = ["ok", "ko", "pending"];
const NO_REPLACEMENT = "none";
const DEFAULT_STATE = "default";
const FOCUS_STATE = "focus"; // a component taking focus is driven by the keyboard
const KEYBOARD_SECTION = "Keyboard";
const USAGE_SECTION = "Usage";
const DEPRECATION_SECTION = "Deprecation";
const VERDICTS_SECTION = "Verdicts";
const BRAND_HEADINGS = ["Project", "Users", "Domain", "Platforms", "Personality and tone", "References", "Anti-references"];

const COMMON_KEYS = ["id", "kind"];
const VERSIONED_KEYS = ["status", "version"]; // all but the system, whose versions are its publications, and the brand
const COMPONENT_KEYS = [...VERSIONED_KEYS, "uses", "tokens", "variants", "states", "role"];
const KIND_KEYS = {
  system: ["format", "platforms", "themes", "locales", "primitives", "code-roots", "ignore"],
  brand: [],
  atom: COMPONENT_KEYS,
  molecule: COMPONENT_KEYS,
  composition: COMPONENT_KEYS,
  screen: [...VERSIONED_KEYS, "uses", "tokens", "states", "breakpoints", "route"],
  journey: [...VERSIONED_KEYS, "persona"],
  asset: [...VERSIONED_KEYS, "type", "file", "alt"],
  review: [...VERSIONED_KEYS, "scope", "screens"],
};
const AXIS_NAME = /^[a-z][a-z-]*$/;
const TAKEN_AXES = { state: "data-state shows the states", variant: "data-variant shows the bare variants", theme: "data-theme switches the token theme" };
const listWithOr = (values) => `${values.slice(0, -1).join(", ")} or ${values.at(-1)}`;
const isDeprecated = (record) => fm(record).status === STATUS_DEPRECATED;
const folderLabel = (folder) => (folder ? `${folder}/` : "aidd_docs/ui/");

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

/** What is wrong with an `axis=value` item of `variants`, or null: a bare item is any value. */
function variantProblem(item) {
  const { axis, value } = variantOf(item);
  if (Object.hasOwn(TAKEN_AXES, axis)) return `variant "${item}": axis "${axis}" is taken, ${TAKEN_AXES[axis]}`;
  if (!AXIS_NAME.test(axis)) return `variant "${item}": axis "${axis}" must match ${AXIS_NAME.source.slice(1, -1)}`;
  return value ? null : `variant "${item}": no value`;
}

function valueProblems(record) {
  const { status, type, kind } = fm(record);
  return [
    ...(status !== undefined && !STATUSES.includes(status) ? [`status "${status}" must be ${listWithOr(STATUSES)}`] : []),
    ...(kind === "asset" && type !== undefined && !ASSET_TYPES.includes(type) ? [`type "${type}" must be ${listWithOr(ASSET_TYPES)}`] : []),
    ...list(fm(record).variants).filter((item) => item.includes(AXIS_SEPARATOR)).map(variantProblem).filter(Boolean),
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
  const published = project.history.filter((row) => row.Id === SYSTEM_ID && !SEMVER.test(row.Version));
  return [
    ...placed(project).flatMap((record) => {
      const version = fm(record).version;
      return version === undefined || INTEGER_VERSION.test(version) ? [] : [problem(record, `version "${version}" must be an integer from 1`)];
    }),
    ...published.map((row) => problem({ file: HISTORY_FILE }, `version "${row.Version}" of ${SYSTEM_ID} must be semver, such as 2.0.0`)),
  ];
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
    return [
      ...(states.includes(DEFAULT_STATE) ? [] : [`component lacks state "${DEFAULT_STATE}"`]),
      ...(states.includes(FOCUS_STATE) && !(KEYBOARD_SECTION in record.sections) ? [`state "${FOCUS_STATE}" needs a "## ${KEYBOARD_SECTION}" section`] : []),
    ].map((message) => problem(record, message));
  });
}

/** The platforms of a component or screen, each one system.md declares; `code` and `platforms`
 * belong to components and screens alone, assets being files. */
function implementationProblems(project) {
  const declared = list(systemOf(project) && fm(systemOf(project)).platforms);
  return placed(project).flatMap((record) => {
    const { kind } = fm(record);
    const wrong = (isSystem(record) ? ["code"] : ["code", "platforms"]).filter((key) => key in fm(record) && !IMPLEMENTED_KINDS.includes(kind));
    if (wrong.length) return wrong.map((key) => problem(record, `${key} is for components and screens, never ${/^[aeiou]/.test(kind) ? "an" : "a"} ${kind}`));
    return list(fm(record).platforms)
      .filter((platform) => !declared.includes(platform))
      .map((platform) => problem(record, `platform "${platform}" is not in system.md`));
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
  const declared = breakpointsOf(system);
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

function reviewStatusProblems(project) {
  return placed(project)
    .filter((record) => fm(record).kind === "review")
    .filter((record) => STATUSES.includes(fm(record).status) && !REVIEW_STATUSES.includes(fm(record).status))
    .map((record) => problem(record, `status "${fm(record).status}" is for elements: reviews are ${listWithOr(REVIEW_STATUSES)}`));
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
  R8: implementationProblems,
  R9: deprecatedProblems,
  R10: deprecatedUseProblems,
  R11: breakpointProblems,
  R12: journeyProblems,
  R13: reviewProblems,
  R14: brandProblems,
  R15: assetProblems,
  R16: reviewStatusProblems,
  R17: usageProblems,
};

/** Every broken record rule, in rule order. */
const check = checkOf(RULES);

module.exports = { check, formatProblem };
