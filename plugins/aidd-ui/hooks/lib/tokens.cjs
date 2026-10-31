// T1 to T10: tokens.json against the DTCG 2025.10 format and color modules, themes and breakpoints
// through its Resolver module, raw CSS extensions, components and screens citing semantic tokens only, and
// the generated tokens.css agreeing with all of it. Composite values are checked for presence
// only, and reach tokens.css as raw CSS alone.
const fs = require("node:fs");
const nodePath = require("node:path");
const { list } = require("./markdown.cjs");
const { placed, systemOf, TOKENED_KINDS } = require("./model.cjs");
const { text, checkOf } = require("./project.cjs");
const { render, customProperty, dependents } = require("./css.cjs");

const RESERVED_KEYS = ["$value", "$type", "$description", "$extensions", "$deprecated", "$extends", "$schema"];
const ROOT_KEY = "$root"; // a stated limit: a group's own token is a named child here
const PROPERTY_PREFIX = "$";
const PATH_SEPARATOR = ".";
const RAW_CSS_EXTENSION = "dev.ai-driven.css"; // a CSS value DTCG cannot hold, such as color-mix() or 100%
const RESOLVER_FILE = "tokens.resolver.json";
const CSS_FILE = "tokens.css";
const RESOLVER_VERSION = "2025.10";
const THEME_MODIFIER = "theme";
const BREAKPOINT_MODIFIER = "breakpoint";
const MEDIA_EXTENSION = "dev.ai-driven.media"; // a breakpoint's media query, verbatim: DTCG has no place for one
const MIN_THEMES_FOR_RESOLVER = 2;
const orderRef = (modifier) => `#/modifiers/${modifier}`;
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
function collect(node, path, groupType, found) {
  for (const key of Object.keys(node)) {
    const child = node[key];
    const childPath = [...path, key];
    if (key.startsWith(PROPERTY_PREFIX)) {
      if (key === ROOT_KEY) found.badNames.push({ path: childPath.join(PATH_SEPARATOR), message: `"${ROOT_KEY}" is not supported, name the token` });
      else if (!RESERVED_KEYS.includes(key)) found.badNames.push({ path: childPath.join(PATH_SEPARATOR), message: `"${key}" is not a reserved key` });
      continue;
    }
    if (isObject(child) && "$value" in child && childKeys(child).some((name) => isObject(child[name]))) found.badNames.push({ path: childPath.join(PATH_SEPARATOR), message: "a token never contains tokens, name them beside it" });
    if (FORBIDDEN_IN_NAME.test(key)) found.badNames.push({ path: childPath.join(PATH_SEPARATOR), message: 'a name never holds ".", "{" or "}"' });
    if (!isObject(child)) continue;
    const name = childPath.join(PATH_SEPARATOR);
    if ("$value" in child || childKeys(child).length === 0) found.tokens.set(name, { path: childPath, node: child, groupType });
    else {
      found.groups.add(name);
      collect(child, childPath, child.$type ?? groupType, found);
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
  return json.value ? collect(json.value, [], json.value.$type, emptyTree()) : { ...emptyTree(), unusable: true, problem: json.problem };
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
const cssName = (path) => customProperty(path.join(PATH_SEPARATOR));

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

const resolverFileOf = (project) => nodePath.posix.join(nodePath.posix.dirname(project.tokensFile), RESOLVER_FILE);
/** The generated stylesheet beside tokens.json, project-relative. */
const cssFileOf = (project) => nodePath.posix.join(nodePath.posix.dirname(project.tokensFile), CSS_FILE);

const applies = (resolver, modifier) => (resolver.resolutionOrder ?? []).some((step) => step?.$ref === orderRef(modifier));

/** A context's files, resolver-relative paths made project-relative, with the problem of a source
 * that is no file reference. */
function contextFiles(name, sources, file, problems) {
  const refs = (Array.isArray(sources) ? sources : []).map((source) => source?.$ref);
  if (refs.some((ref) => typeof ref !== "string")) problems.push({ file, message: `context "${name}": each source is {"$ref": "<file>"}` });
  return refs.filter((ref) => typeof ref === "string").map((ref) => nodePath.posix.join(nodePath.posix.dirname(file), ref));
}

/** The Resolver's theme contexts as `{theme: [file]}`, with what keeps it from naming them.
 * This plugin reads one profile of the module: a set holding tokens.json, then a `theme`
 * modifier whose contexts are the themes system.md declares, each a list of `$ref` files, needed
 * from two themes on. */
function resolverContexts(resolver, themes, project, file) {
  const at = (message) => ({ file, message });
  const problems = [];
  if (resolver.version !== RESOLVER_VERSION) problems.push(at(`version must be "${RESOLVER_VERSION}"`));
  const holdsTokens = Object.values(isObject(resolver.sets) ? resolver.sets : {}).some((set) => (set?.sources ?? []).some((source) => source?.$ref === nodePath.posix.basename(project.tokensFile)));
  if (!holdsTokens) problems.push(at(`no set holds ${nodePath.posix.basename(project.tokensFile)}`));
  const modifier = resolver.modifiers?.[THEME_MODIFIER];
  if (modifier === undefined && themes.length < MIN_THEMES_FOR_RESOLVER) return { problems, contexts: {} };
  if (!isObject(modifier) || !isObject(modifier.contexts)) return { problems: [...problems, at(`no "${THEME_MODIFIER}" modifier with contexts`)], contexts: {} };
  if (!applies(resolver, THEME_MODIFIER)) problems.push(at(`resolutionOrder never applies ${orderRef(THEME_MODIFIER)}`));
  if (modifier.default !== themes[0]) problems.push(at(`the theme modifier's default must be "${themes[0]}", the first theme in system.md`));
  for (const theme of themes) if (!Object.hasOwn(modifier.contexts, theme)) problems.push(at(`no context for theme "${theme}"`));
  const contexts = {};
  for (const [theme, sources] of Object.entries(modifier.contexts)) {
    if (!themes.includes(theme)) problems.push(at(`context "${theme}" is not a theme in system.md`));
    contexts[theme] = contextFiles(theme, sources, file, problems);
  }
  return { problems, contexts };
}

/** The Resolver's breakpoint contexts in its order, `[{breakpoint, media, files}]`, with what keeps
 * it from naming them. The modifier is optional. Its `default` is the context tokens.json holds,
 * so it lists no source and has no query: the module needs it to resolve without an input. Every
 * other context lists `$ref` files, and its query sits in the modifier's extension, a context
 * being an array that has no place for one. */
function breakpointContexts(resolver, breakpoints, file) {
  const at = (message) => ({ file, message });
  const modifier = resolver.modifiers?.[BREAKPOINT_MODIFIER];
  if (modifier === undefined) return { problems: [], contexts: [] };
  if (!isObject(modifier) || !isObject(modifier.contexts)) return { problems: [at(`no "${BREAKPOINT_MODIFIER}" modifier with contexts`)], contexts: [] };
  const problems = [];
  if (!applies(resolver, BREAKPOINT_MODIFIER)) problems.push(at(`resolutionOrder never applies ${orderRef(BREAKPOINT_MODIFIER)}`));
  if (!Object.hasOwn(modifier.contexts, modifier.default)) return { problems: [...problems, at("the breakpoint modifier's default must name the context tokens.json holds")], contexts: [] };
  const extension = modifier.$extensions?.[MEDIA_EXTENSION];
  const queries = isObject(extension) ? extension : {};
  for (const name of Object.keys(queries)) if (name === modifier.default || !Object.hasOwn(modifier.contexts, name)) problems.push(at(`${MEDIA_EXTENSION} "${name}" names no context outside the default`));
  const contexts = [];
  for (const [breakpoint, sources] of Object.entries(modifier.contexts)) {
    if (!breakpoints.includes(breakpoint)) problems.push(at(`context "${breakpoint}" is not a breakpoint in system.md`));
    if (breakpoint === modifier.default) {
      if (Array.isArray(sources) && sources.length) problems.push(at(`context "${breakpoint}" is the default, held by tokens.json: it lists no source`));
      continue;
    }
    const media = queries[breakpoint];
    if (typeof media !== "string" || !media.trim()) problems.push(at(`context "${breakpoint}" has no media string under ${MEDIA_EXTENSION}`));
    contexts.push({ breakpoint, media, files: contextFiles(breakpoint, sources, file, problems) });
  }
  return { problems, contexts };
}

/** What a theme or breakpoint file earns: each token it redefines exists in tokens.json, keeps its
 * type, and holds a value of that type. `owner` names who redefines it. */
function redefinitionProblems(tree, project, owner, file) {
  const themed = readTree(project, file);
  if (themed.unusable) return themed.problem ? [{ file, message: themed.problem }] : [];
  const at = tokenProblem(project, file);
  return [...themed.tokens].flatMap(([name, token]) => {
    const base = tree.tokens.get(name);
    if (!base) return [at(name, `${owner} redefines no token of tokens.json`)];
    const type = typeOf(tree, base);
    if (token.node.$type !== undefined && token.node.$type !== type) return [at(name, `$type "${token.node.$type}" differs from tokens.json's "${type}"`)];
    const message = shapeProblem(type, token.node.$value) ?? aliasProblem(tree, token.node.$value, type);
    return message ? [at(name, `${owner}: ${message}`)] : [];
  });
}

/** The first theme system.md declares is the base, held by tokens.json; every other one, and every
 * breakpoint that changes a value, is a context of tokens.resolver.json, whose files redefine base
 * tokens only and never the same one: each token has one owner, so no block hides another. */
function resolverProblems(tree, project) {
  const themes = list(systemOf(project)?.frontMatter.themes);
  const file = resolverFileOf(project);
  const resolver = readJson(project, file);
  if (resolver.problem === MISSING && themes.length < MIN_THEMES_FOR_RESOLVER) return [];
  if (!resolver.value) return resolver.problem ? [{ file, message: resolver.problem }] : [];
  const { problems, contexts } = resolverContexts(resolver.value, themes, project, file);
  const breakpoints = breakpointContexts(resolver.value, list(systemOf(project)?.frontMatter.breakpoints), file);
  const found = [...problems, ...breakpoints.problems];
  if (tree.unusable) return found; // a context file is read against tokens.json, which T1 names
  return [
    ...found,
    ...Object.entries(contexts).flatMap(([theme, files]) => files.flatMap((themeFile) => redefinitionProblems(tree, project, `theme "${theme}"`, themeFile))),
    ...breakpoints.contexts.flatMap(({ breakpoint, files }) => files.flatMap((context) => redefinitionProblems(tree, project, `breakpoint "${breakpoint}"`, context))),
    ...ownerProblems(tree, project),
  ];
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

/** A token as the stylesheet sees it: its raw CSS, else the token its alias names, else its value. */
function entryOf(name, token, type, file) {
  const alias = aliasOf(token.node.$value);
  if (isRaw(token)) return { name, type, file, raw: rawCssOf(token) };
  return alias === undefined ? { name, type, file, value: token.node.$value } : { name, type, file, alias };
}

/** What each non-base theme redefines, in system.md order, as its Resolver context files list it:
 * `{theme, files: [{file, tree}]}`. */
function themeTrees(project) {
  const themes = list(systemOf(project)?.frontMatter.themes);
  const resolver = readJson(project, resolverFileOf(project));
  const { contexts } = resolver.value ? resolverContexts(resolver.value, themes, project, resolverFileOf(project)) : { contexts: {} };
  return themes.slice(1).map((theme) => ({ theme, files: (contexts[theme] ?? []).map((file) => ({ file, tree: readTree(project, file) })) }));
}

/** What each breakpoint context redefines, in the Resolver's order: `{breakpoint, media, files: [{file, tree}]}`. */
function breakpointTrees(project) {
  const resolver = readJson(project, resolverFileOf(project));
  const { contexts } = resolver.value ? breakpointContexts(resolver.value, list(systemOf(project)?.frontMatter.breakpoints), resolverFileOf(project)) : { contexts: [] };
  return contexts.map(({ files, ...context }) => ({ ...context, files: files.map((file) => ({ file, tree: readTree(project, file) })) }));
}

/** The tokens of context files as the stylesheet sees them, `typeFor` giving each its type. */
const contextEntries = (files, typeFor = () => undefined) => files.flatMap(({ file, tree: own }) => [...own.tokens].map(([name, token]) => entryOf(name, token, typeFor(name), file)));

/** A token a theme block holds, whether redefined there or redeclared as depending on one that is,
 * cannot also be a breakpoint's: on a nested region that block would hide the breakpoint's value.
 * A breakpoint value citing such a token counts too: a nested region would inherit it stale. */
function ownerProblems(tree, project) {
  const breakpoints = breakpointTrees(project).map(({ breakpoint, files }) => ({ breakpoint, tokens: contextEntries(files) }));
  const base = [...tree.tokens].map(([name, token]) => entryOf(name, token, undefined, project.tokensFile));
  const everyDeclaration = [...base, ...breakpoints.flatMap(({ tokens }) => tokens)];
  return themeTrees(project).flatMap(({ theme, files }) => {
    const own = contextEntries(files);
    const held = new Set([...own, ...dependents(everyDeclaration, own)].map((entry) => entry.name));
    return breakpoints.flatMap(({ breakpoint, tokens }) =>
      tokens.filter((entry) => held.has(entry.name)).map((entry) => ({ file: entry.file, message: `${entry.name}: theme "${theme}" and breakpoint "${breakpoint}" both set it, so a themed region would ignore the breakpoint` }))
    );
  });
}

/** The stylesheet of tokens that have no error, `{css, problems}`: `css` is null when a composite
 * token has no raw CSS, which `problems` names. */
function generate(project) {
  const tree = read(project);
  const base = [...tree.tokens].map(([name, token]) => entryOf(name, token, typeOf(tree, token), project.tokensFile));
  const typeFor = (name) => typeOf(tree, tree.tokens.get(name));
  return render({
    base,
    baseTheme: list(systemOf(project)?.frontMatter.themes)[0],
    themes: themeTrees(project).map(({ theme, files }) => ({ theme, tokens: contextEntries(files, typeFor) })),
    breakpoints: breakpointTrees(project).map(({ media, files }) => ({ media, tokens: contextEntries(files, typeFor) })),
  });
}

const BASE_RULES = {
  T1: jsonProblems,
  T2: nameProblems,
  T3: typeProblems,
  T4: shapeProblems,
  T5: aliasProblems,
  T6: resolverProblems,
  T7: citedTokenProblems,
  T8: primitiveProblems,
  T9: rawCssProblems,
};

const run = (find, project) => find(read(project), project);

/** The problems that keep tokens.css from being generated: every token rule but T10. */
const blockers = checkOf(BASE_RULES, run);

const REGENERATE = "with the engine's tokens command";

/** tokens.css is what the tokens generate. It is not judged while the tokens have an error, and a
 * composite token without raw CSS is named, since no stylesheet can carry it. */
function stylesheetProblems(tree, project) {
  if (blockers(project).length) return [];
  const { css, problems } = generate(project);
  if (css === null) return problems;
  const file = cssFileOf(project);
  if (!fs.existsSync(nodePath.join(project.root, file))) return [{ file, message: `missing, generate it ${REGENERATE}` }];
  const current = text(project, file);
  return current === null || current === css ? [] : [{ file, message: `out of date with the tokens, regenerate it ${REGENERATE}` }];
}

const RULES = { ...BASE_RULES, T10: stylesheetProblems };

/** Every broken token rule, in rule order. */
const check = checkOf(RULES, run);

/** Every token's CSS custom property, `--` plus its path joined by `-`; null when tokens.json
 * cannot be read, so renders do not repeat T1. */
function cssNames(project) {
  const tree = read(project);
  return tree.unusable ? null : new Set([...tree.tokens.values()].map((token) => cssName(token.path)));
}

/** Every token's name by its CSS custom property. */
const namesByProperty = (tree) => new Map([...tree.tokens].map(([name, token]) => [cssName(token.path), name]));

/** The tokens each token cites, by name: the one its alias names and those whose custom property
 * a `var()` of its raw CSS names, in tokens.json or in any theme or breakpoint file. Empty when tokens.json
 * cannot be read. */
function citations(project) {
  const tree = read(project);
  const byProperty = namesByProperty(tree);
  const citedBy = (token) => [aliasOf(token.node.$value), ...[...(typeof rawCssOf(token) === "string" ? rawCssOf(token) : "").matchAll(CSS_VARIABLE)].map((match) => byProperty.get(match[1]))];
  const found = new Map([...tree.tokens].map(([name, token]) => [name, citedBy(token)]));
  for (const { files } of [...themeTrees(project), ...breakpointTrees(project)]) {
    for (const { tree: themed } of files) for (const [name, token] of themed.tokens) found.get(name)?.push(...citedBy(token));
  }
  return new Map([...found].map(([name, cited]) => [name, [...new Set(cited.filter((target) => tree.tokens.has(target)))]]));
}

/** The token a ref names, whether written as its path or as its CSS custom property; the ref
 * itself when it names none. */
const tokenNameOf = (project, ref) => namesByProperty(read(project)).get(ref) ?? ref;

/** A token path's CSS custom property. */
const cssNameOf = customProperty;

module.exports = { check, blockers, generate, citations, tokenNameOf, cssNames, cssNameOf, cssFileOf };
