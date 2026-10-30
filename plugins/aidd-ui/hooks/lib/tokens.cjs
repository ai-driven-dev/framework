// T1 to T8: tokens.json against the DTCG 2025.10 format and color modules, plus this plugin's
// themes and raw CSS extensions, and components citing semantic tokens only. Composite values are checked for presence only.
const fs = require("node:fs");
const nodePath = require("node:path");
const { list } = require("./markdown.cjs");
const { placed, systemOf, COMPONENT_KINDS } = require("./records.cjs");
const { text } = require("./project.cjs");

const RESERVED_KEYS = ["$value", "$type", "$description", "$extensions", "$deprecated", "$extends", "$schema"];
const ROOT_KEY = "$root"; // a stated limit: a group's own token is a named child here
const PROPERTY_PREFIX = "$";
const PATH_SEPARATOR = ".";
const CSS_PREFIX = "--";
const CSS_SEPARATOR = "-";
const THEMES_EXTENSION = "dev.ai-driven.themes";
const RAW_CSS_EXTENSION = "dev.ai-driven.css"; // a CSS value DTCG cannot hold, such as color-mix() or 100%
const MISSING = "missing";
const NOT_JSON = "not JSON";

const PRIMITIVE_TYPES = ["color", "dimension", "fontFamily", "fontWeight", "duration", "cubicBezier", "number"];
const COMPOSITE_TYPES = ["strokeStyle", "border", "transition", "shadow", "gradient", "typography"];
const TYPES = [...PRIMITIVE_TYPES, ...COMPOSITE_TYPES];
const COLOR_SPACES = ["srgb", "srgb-linear", "hsl", "hwb", "lab", "lch", "oklab", "oklch", "display-p3", "a98-rgb", "prophoto-rgb", "rec2020", "xyz-d65", "xyz-d50"];
const COLOR_COMPONENTS = 3;
const NO_COMPONENT = "none";
const DIMENSION_UNITS = ["px", "rem"];
const DURATION_UNITS = ["ms", "s"];
const FONT_WEIGHT_MIN = 1;
const FONT_WEIGHT_MAX = 1000;
const FONT_WEIGHT_KEYWORDS = ["thin", "hairline", "extra-light", "ultra-light", "light", "normal", "regular", "book", "medium", "semi-bold", "demi-bold", "bold", "extra-bold", "ultra-bold", "black", "heavy", "extra-black", "ultra-black"];
const BEZIER_POINTS = 4;
const BEZIER_X_INDEXES = [0, 2];
const MAX_ALIAS_DEPTH = 32; // alias cycles are a stated limit; this only stops the walk

const FORBIDDEN_IN_NAME = /[{}.]/;
const ALIAS = /^\{([^{}]+)\}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const childKeys = (node) => Object.keys(node).filter((key) => !key.startsWith(PROPERTY_PREFIX));
const aliasOf = (value) => (typeof value === "string" ? ALIAS.exec(value)?.[1] : undefined);

/** Every token and group of the tree, each with its path and the closest group `$type`. */
function walk(node, path, groupType, found) {
  for (const key of Object.keys(node)) {
    const child = node[key];
    const childPath = [...path, key];
    if (key.startsWith(PROPERTY_PREFIX)) {
      if (key === ROOT_KEY) found.badNames.push({ path: childPath.join(PATH_SEPARATOR), message: `"${ROOT_KEY}" is not supported, name the token` });
      else if (!RESERVED_KEYS.includes(key)) found.badNames.push({ path: childPath.join(PATH_SEPARATOR), message: `"${key}" is not a reserved key` });
      continue;
    }
    if (FORBIDDEN_IN_NAME.test(key)) found.badNames.push({ path: childPath.join(PATH_SEPARATOR), message: 'a name never holds ".", "{" or "}"' });
    if (!isObject(child)) continue;
    const name = childPath.join(PATH_SEPARATOR);
    if ("$value" in child || childKeys(child).length === 0) found.tokens.set(name, { path: childPath, node: child, groupType });
    else {
      found.groups.add(name);
      walk(child, childPath, child.$type ?? groupType, found);
    }
  }
  return found;
}

const emptyTree = () => ({ tokens: new Map(), groups: new Set(), badNames: [] });

/** A tree no rule can read, with its T1 problem; null when unreadable, which the loader reports. */
const unusable = (problem) => ({ ...emptyTree(), unusable: true, problem });

/** The tree: its tokens, groups and bad names, or why it cannot be read. */
function read(project) {
  if (!fs.existsSync(nodePath.join(project.root, project.tokensFile))) return unusable(MISSING);
  const source = text(project, project.tokensFile);
  if (source === null) return unusable(null);
  let tree;
  try {
    tree = JSON.parse(source);
  } catch {
    return unusable(NOT_JSON);
  }
  return isObject(tree) ? walk(tree, [], tree.$type, emptyTree()) : unusable(NOT_JSON);
}

/** A token's raw CSS value when it carries one: DTCG has no form for it, so no type or shape. */
const rawCssOf = (token) => token.node.$extensions?.[RAW_CSS_EXTENSION];
const isRaw = (token) => rawCssOf(token) !== undefined;

/** A token's `$type`: its own, else its alias target's, else its closest group's. */
function typeOf(tree, token, depth = 0) {
  if (token.node.$type !== undefined) return token.node.$type;
  const target = tree.tokens.get(aliasOf(token.node.$value));
  if (target && depth < MAX_ALIAS_DEPTH) return typeOf(tree, target, depth + 1);
  return token.groupType;
}

function colorProblem(value) {
  if (!isObject(value)) return "a color is {colorSpace, components, alpha?, hex?}";
  if (!COLOR_SPACES.includes(value.colorSpace)) return `colorSpace "${value.colorSpace}" is not a DTCG colour space`;
  const components = value.components;
  if (!Array.isArray(components) || components.length !== COLOR_COMPONENTS || !components.every((part) => isNumber(part) || part === NO_COMPONENT)) {
    return 'components must be three numbers or "none"';
  }
  if (value.alpha !== undefined && !(isNumber(value.alpha) && value.alpha >= 0 && value.alpha <= 1)) return "alpha must be a number in 0..1";
  if (value.hex !== undefined && !HEX.test(value.hex)) return `hex "${value.hex}" must be # and six hex digits`;
  return null;
}

function measureProblem(value, units) {
  if (!isObject(value) || !isNumber(value.value)) return `a measure is {value: number, unit: ${units.join(" or ")}}`;
  return units.includes(value.unit) ? null : `unit "${value.unit}" must be ${units.join(" or ")}`;
}

function fontWeightProblem(value) {
  if (isNumber(value) && value >= FONT_WEIGHT_MIN && value <= FONT_WEIGHT_MAX) return null;
  if (FONT_WEIGHT_KEYWORDS.includes(value)) return null;
  return `fontWeight ${JSON.stringify(value)} must be 1 to 1000 or a keyword`;
}

function cubicBezierProblem(value) {
  const valid = Array.isArray(value) && value.length === BEZIER_POINTS && value.every(isNumber) && BEZIER_X_INDEXES.every((index) => value[index] >= 0 && value[index] <= 1);
  return valid ? null : "cubicBezier needs four numbers, x in 0..1";
}

function fontFamilyProblem(value) {
  const valid = typeof value === "string" || (Array.isArray(value) && value.length > 0 && value.every((name) => typeof name === "string"));
  return valid ? null : "fontFamily is a name or a list of names";
}

const SHAPES = {
  color: colorProblem,
  dimension: (value) => measureProblem(value, DIMENSION_UNITS),
  duration: (value) => measureProblem(value, DURATION_UNITS),
  fontWeight: fontWeightProblem,
  cubicBezier: cubicBezierProblem,
  fontFamily: fontFamilyProblem,
  number: (value) => (isNumber(value) ? null : "a number token holds a number"),
};

/** What is wrong with a value of `type`, or null. Aliases and composites are not shapes. */
const shapeProblem = (type, value) => (aliasOf(value) !== undefined || !SHAPES[type] ? null : SHAPES[type](value));

/** A problem builder for tokens.json, naming the token path first. */
const tokenProblem = (project) => (path, message) => ({ file: project.tokensFile, message: `${path}: ${message}` });
const themesOf = (token) => (isObject(token.node.$extensions?.[THEMES_EXTENSION]) ? token.node.$extensions[THEMES_EXTENSION] : {});

function jsonProblems(tree, project) {
  return tree.problem ? [{ file: project.tokensFile, message: tree.problem }] : [];
}

function nameProblems(tree, project) {
  const at = tokenProblem(project);
  return tree.badNames.map((bad) => at(bad.path, bad.message));
}

function typeProblems(tree, project) {
  const at = tokenProblem(project);
  return [...tree.tokens].flatMap(([name, token]) => {
    if (isRaw(token)) return typeof rawCssOf(token) === "string" && rawCssOf(token).trim() ? [] : [at(name, `${RAW_CSS_EXTENSION} must be a CSS value`)];
    if (!("$value" in token.node)) return [at(name, "no $value")];
    if (aliasProblem(tree, token.node.$value)) return []; // T5 names the broken alias
    const type = typeOf(tree, token);
    if (type === undefined) return [at(name, "no $type on it, its alias or a parent group")];
    return TYPES.includes(type) ? [] : [at(name, `$type "${type}" is not a DTCG type`)];
  });
}

function shapeProblems(tree, project) {
  const at = tokenProblem(project);
  return [...tree.tokens].flatMap(([name, token]) => {
    const message = "$value" in token.node && !isRaw(token) ? shapeProblem(typeOf(tree, token), token.node.$value) : null;
    return message ? [at(name, message)] : [];
  });
}

/** What is wrong with an alias, or null: its target must be a token, of `type` when given. */
function aliasProblem(tree, value, type) {
  const target = aliasOf(value);
  if (target === undefined) return null;
  if (!tree.tokens.has(target)) return tree.groups.has(target) ? `alias {${target}} names a group, not a token` : `alias {${target}} names no token`;
  const targetType = typeOf(tree, tree.tokens.get(target));
  return type === undefined || targetType === undefined || targetType === type ? null : `alias {${target}} is a ${targetType}, not a ${type}`;
}

function aliasProblems(tree, project) {
  const at = tokenProblem(project);
  return [...tree.tokens].flatMap(([name, token]) => {
    const message = aliasProblem(tree, token.node.$value, token.node.$type ?? token.groupType);
    return message ? [at(name, message)] : [];
  });
}

/** The first theme system.md declares is the base, held by `$value`; a themed token gives
 * every other one. */
function themeProblems(tree, project) {
  const at = tokenProblem(project);
  const system = systemOf(project);
  const [base, ...others] = list(system?.frontMatter.themes);
  return [...tree.tokens].flatMap(([name, token]) => {
    const themes = themesOf(token);
    if (Object.keys(themes).length === 0) return [];
    const missing = system ? others.filter((theme) => !(theme in themes)).map((theme) => at(name, `no value for theme "${theme}"`)) : [];
    const values = Object.entries(themes).flatMap(([theme, value]) => {
      if (system && theme === base) return [at(name, `theme "${theme}" is the base, its value is $value`)];
      if (system && !others.includes(theme)) return [at(name, `theme "${theme}" is not in system.md`)];
      const type = typeOf(tree, token);
      const message = shapeProblem(type, value) ?? aliasProblem(tree, value, type);
      return message ? [at(name, `theme "${theme}": ${message}`)] : [];
    });
    return [...missing, ...values];
  });
}

function componentTokenProblems(tree, project) {
  if (tree.unusable) return [];
  return placed(project)
    .filter((record) => COMPONENT_KINDS.includes(record.frontMatter.kind))
    .flatMap((record) =>
      list(record.frontMatter.tokens)
        .filter((name) => !tree.tokens.has(name))
        .map((name) => ({ file: record.file, message: `token "${name}" is not in tokens.json` }))
    );
}

/** Whether a token path sits under a group system.md declares primitive. */
const isPrimitive = (name, groups) => groups.some((group) => name === group || name.startsWith(`${group}${PATH_SEPARATOR}`));

function primitiveProblems(tree, project) {
  const groups = list(systemOf(project)?.frontMatter.primitives);
  return placed(project)
    .filter((record) => COMPONENT_KINDS.includes(record.frontMatter.kind))
    .flatMap((record) =>
      list(record.frontMatter.tokens)
        .filter((name) => isPrimitive(name, groups))
        .map((name) => ({ file: record.file, message: `token "${name}" is a primitive, use a semantic token` }))
    );
}

const RULES = [
  jsonProblems, // T1
  nameProblems, // T2
  typeProblems, // T3
  shapeProblems, // T4
  aliasProblems, // T5
  themeProblems, // T6
  componentTokenProblems, // T7
  primitiveProblems, // T8
];

/** Every broken token rule, as `{file, message}`, in rule order. */
function check(project) {
  const tree = read(project);
  return RULES.flatMap((rule) => rule(tree, project));
}

/** Every token's CSS custom property, `--` plus its path joined by `-`; null when tokens.json
 * cannot be read, so renders do not repeat T1. */
function cssNames(project) {
  const tree = read(project);
  if (tree.unusable) return null;
  return new Set([...tree.tokens.values()].map((token) => `${CSS_PREFIX}${token.path.join(CSS_SEPARATOR)}`));
}

module.exports = { check, cssNames };
