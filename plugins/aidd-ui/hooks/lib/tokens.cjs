// T1 to T9: tokens.json against the DTCG 2025.10 format and color modules, themes through its
// Resolver module, raw CSS extensions, and components and screens citing semantic tokens only.
// Composite values are checked for presence only.
const fs = require("node:fs");
const nodePath = require("node:path");
const { list } = require("./markdown.cjs");
const { placed, systemOf, TOKENED_KINDS } = require("./records.cjs");
const { text, checkOf } = require("./project.cjs");

const RESERVED_KEYS = ["$value", "$type", "$description", "$extensions", "$deprecated", "$extends", "$schema"];
const ROOT_KEY = "$root"; // a stated limit: a group's own token is a named child here
const PROPERTY_PREFIX = "$";
const PATH_SEPARATOR = ".";
const CSS_PREFIX = "--";
const CSS_SEPARATOR = "-";
const RAW_CSS_EXTENSION = "dev.ai-driven.css"; // a CSS value DTCG cannot hold, such as color-mix() or 100%
const RESOLVER_FILE = "tokens.resolver.json";
const RESOLVER_VERSION = "2025.10";
const THEME_MODIFIER = "theme";
const THEME_ORDER_REF = `#/modifiers/${THEME_MODIFIER}`;
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

const FORBIDDEN_IN_NAME = /[{}.]/;
const ALIAS = /^\{([^{}]+)\}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const CSS_VARIABLE = /var\(\s*(--[\w-]+)/g;

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

/** A JSON object of the design system, or the one problem it earns: null when unreadable,
 * which the loader reports. */
function readJson(project, file) {
  if (!fs.existsSync(nodePath.join(project.root, file))) return { problem: MISSING };
  const source = text(project, file);
  if (source === null) return { problem: null };
  try {
    const value = JSON.parse(source);
    return isObject(value) ? { value } : { problem: NOT_JSON };
  } catch {
    return { problem: NOT_JSON };
  }
}

/** A token file's tree: its tokens, groups and bad names, or why it cannot be read. */
function readTree(project, file) {
  const json = readJson(project, file);
  return json.value ? walk(json.value, [], json.value.$type, emptyTree()) : { ...emptyTree(), unusable: true, problem: json.problem };
}

/** tokens.json's tree, read once per run. */
function read(project) {
  project.tokenTree ??= readTree(project, project.tokensFile);
  return project.tokenTree;
}

/** A token's raw CSS value when it carries one: DTCG has no form for it, so no type or shape. */
const rawCssOf = (token) => token.node.$extensions?.[RAW_CSS_EXTENSION];
const isRaw = (token) => rawCssOf(token) !== undefined;

/** A token's `$type`: its own, else its alias target's, else its closest group's. A cycle
 * stops at the token it comes back to. */
function typeOf(tree, token, seen = new Set()) {
  if (token.node.$type !== undefined) return token.node.$type;
  const target = tree.tokens.get(aliasOf(token.node.$value));
  if (!target || seen.has(target)) return token.groupType;
  seen.add(token);
  return typeOf(tree, target, seen);
}

/** Whether following aliases from `value` comes back to the token `name`. */
function loopsBack(tree, value, name) {
  const seen = new Set();
  for (let target = aliasOf(value); tree.tokens.has(target) && !seen.has(target); target = aliasOf(tree.tokens.get(target).node.$value)) {
    if (target === name) return true;
    seen.add(target);
  }
  return false;
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

/** A problem builder for a token file, tokens.json by default, naming the token path first. */
const tokenProblem = (project, file = project.tokensFile) => (path, message) => ({ file, message: `${path}: ${message}` });
const cssName = (path) => `${CSS_PREFIX}${path.join(CSS_SEPARATOR)}`;

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
    if (aliasProblem(tree, token.node.$value, undefined, name)) return []; // T5 names the broken alias
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

/** What is wrong with an alias, or null: its target must be a token, of `type` when given, that
 * never leads back to the token `name` holding it. */
function aliasProblem(tree, value, type, name) {
  const target = aliasOf(value);
  if (target === undefined) return null;
  if (!tree.tokens.has(target)) return tree.groups.has(target) ? `alias {${target}} names a group, not a token` : `alias {${target}} names no token`;
  if (name !== undefined && loopsBack(tree, value, name)) return `alias {${target}} loops back to ${name}`;
  const targetType = typeOf(tree, tree.tokens.get(target));
  return type === undefined || targetType === undefined || targetType === type ? null : `alias {${target}} is a ${targetType}, not a ${type}`;
}

function aliasProblems(tree, project) {
  const at = tokenProblem(project);
  return [...tree.tokens].flatMap(([name, token]) => {
    const message = aliasProblem(tree, token.node.$value, token.node.$type ?? token.groupType, name);
    return message ? [at(name, message)] : [];
  });
}

/** The Resolver's theme contexts as `{theme: [file]}`, with what keeps it from naming them.
 * This plugin reads one profile of the module: a set holding tokens.json, then a `theme`
 * modifier whose contexts are the themes system.md declares, each a list of `$ref` files. */
function resolverContexts(resolver, themes, project, file) {
  const at = (message) => ({ file, message });
  const problems = [];
  if (resolver.version !== RESOLVER_VERSION) problems.push(at(`version must be "${RESOLVER_VERSION}"`));
  const holdsTokens = Object.values(isObject(resolver.sets) ? resolver.sets : {}).some((set) => (set?.sources ?? []).some((source) => source?.$ref === nodePath.posix.basename(project.tokensFile)));
  if (!holdsTokens) problems.push(at(`no set holds ${nodePath.posix.basename(project.tokensFile)}`));
  const modifier = resolver.modifiers?.[THEME_MODIFIER];
  if (!isObject(modifier) || !isObject(modifier.contexts)) return { problems: [...problems, at(`no "${THEME_MODIFIER}" modifier with contexts`)], contexts: {} };
  if (!(resolver.resolutionOrder ?? []).some((step) => step?.$ref === THEME_ORDER_REF)) problems.push(at(`resolutionOrder never applies ${THEME_ORDER_REF}`));
  if (modifier.default !== themes[0]) problems.push(at(`the theme modifier's default must be "${themes[0]}", the first theme in system.md`));
  for (const theme of themes) if (!Object.hasOwn(modifier.contexts, theme)) problems.push(at(`no context for theme "${theme}"`));
  const contexts = {};
  for (const [theme, sources] of Object.entries(modifier.contexts)) {
    if (!themes.includes(theme)) problems.push(at(`context "${theme}" is not a theme in system.md`));
    const refs = (Array.isArray(sources) ? sources : []).map((source) => source?.$ref);
    if (refs.some((ref) => typeof ref !== "string")) problems.push(at(`context "${theme}": each source is {"$ref": "<file>"}`));
    contexts[theme] = refs.filter((ref) => typeof ref === "string").map((ref) => nodePath.posix.join(nodePath.posix.dirname(file), ref));
  }
  return { problems, contexts };
}

/** What a theme file earns: each token it redefines exists in tokens.json, keeps its type, and
 * holds a value of that type. */
function themeFileProblems(tree, project, theme, file) {
  const themed = readTree(project, file);
  if (themed.unusable) return themed.problem ? [{ file, message: themed.problem }] : [];
  const at = tokenProblem(project, file);
  return [...themed.tokens].flatMap(([name, token]) => {
    const base = tree.tokens.get(name);
    if (!base) return [at(name, `theme "${theme}" redefines no token of tokens.json`)];
    const type = typeOf(tree, base);
    if (token.node.$type !== undefined && token.node.$type !== type) return [at(name, `$type "${token.node.$type}" differs from tokens.json's "${type}"`)];
    const message = shapeProblem(type, token.node.$value) ?? aliasProblem(tree, token.node.$value, type);
    return message ? [at(name, `theme "${theme}": ${message}`)] : [];
  });
}

/** The first theme system.md declares is the base, held by tokens.json; every other one is a
 * context of tokens.resolver.json, whose files redefine base tokens only. */
function themeProblems(tree, project) {
  const themes = list(systemOf(project)?.frontMatter.themes);
  const file = nodePath.posix.join(nodePath.posix.dirname(project.tokensFile), RESOLVER_FILE);
  const resolver = readJson(project, file);
  if (resolver.problem === MISSING && themes.length < 2) return [];
  if (!resolver.value) return resolver.problem ? [{ file, message: resolver.problem }] : [];
  const { problems, contexts } = resolverContexts(resolver.value, themes, project, file);
  if (tree.unusable) return problems; // a theme file is read against tokens.json, which T1 names
  return [...problems, ...Object.entries(contexts).flatMap(([theme, files]) => files.flatMap((themeFile) => themeFileProblems(tree, project, theme, themeFile)))];
}

/** A raw CSS value's `var()`s name tokens: they are its dependencies. */
function rawCssProblems(tree, project) {
  const at = tokenProblem(project);
  const names = new Set([...tree.tokens.values()].map((token) => cssName(token.path)));
  return [...tree.tokens]
    .filter(([, token]) => typeof rawCssOf(token) === "string")
    .flatMap(([name, token]) => [...rawCssOf(token).matchAll(CSS_VARIABLE)].filter((match) => !names.has(match[1])).map((match) => at(name, `var(${match[1]}) names no token`)));
}

/** Components and screens, which cite tokens. */
const tokened = (project) => placed(project).filter((record) => TOKENED_KINDS.includes(record.frontMatter.kind));

function citedTokenProblems(tree, project) {
  if (tree.unusable) return [];
  return tokened(project).flatMap((record) =>
    list(record.frontMatter.tokens)
      .filter((name) => !tree.tokens.has(name))
      .map((name) => ({ file: record.file, message: `token "${name}" is not in tokens.json` }))
  );
}

/** Whether a token path sits under a group system.md declares primitive. */
const isPrimitive = (name, groups) => groups.some((group) => name === group || name.startsWith(`${group}${PATH_SEPARATOR}`));

function primitiveProblems(tree, project) {
  const groups = list(systemOf(project)?.frontMatter.primitives);
  return tokened(project).flatMap((record) =>
    list(record.frontMatter.tokens)
      .filter((name) => isPrimitive(name, groups))
      .map((name) => ({ file: record.file, message: `token "${name}" is a primitive, use a semantic token` }))
  );
}

const RULES = {
  T1: jsonProblems,
  T2: nameProblems,
  T3: typeProblems,
  T4: shapeProblems,
  T5: aliasProblems,
  T6: themeProblems,
  T7: citedTokenProblems,
  T8: primitiveProblems,
  T9: rawCssProblems,
};

/** Every broken token rule, in rule order. */
const check = checkOf(RULES, (find, project) => find(read(project), project));

/** Every token's CSS custom property, `--` plus its path joined by `-`; null when tokens.json
 * cannot be read, so renders do not repeat T1. */
function cssNames(project) {
  const tree = read(project);
  return tree.unusable ? null : new Set([...tree.tokens.values()].map((token) => cssName(token.path)));
}

/** A token path's CSS custom property. */
const cssNameOf = (name) => cssName(name.split(PATH_SEPARATOR));

module.exports = { check, cssNames, cssNameOf };
