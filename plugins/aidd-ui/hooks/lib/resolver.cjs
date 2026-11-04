// The Resolver, tokens.resolver.json, derived from system.md and the context files beside tokens.json.
// `tokens` and `extract` write it through the same function; nobody writes it by hand. A theme,
// platform or breakpoint context holds `<folder>/<name>.json`, the first of each list being the
// default, which tokens.json itself holds.
const fs = require("node:fs");
const path = require("node:path");
const { list, table } = require("./markdown.cjs");
const { systemOf, fm } = require("./model.cjs");

const RESOLVER_FILE = "tokens.resolver.json";
const RESOLVER_VERSION = "2025.10";
const MEDIA_EXTENSION = "dev.ai-driven.media"; // a breakpoint's media query, verbatim: DTCG has no place for one
const MODIFIERS = { theme: "theme", platform: "platform", breakpoint: "breakpoint" };
const FOLDERS = { theme: "themes", platform: "platforms", breakpoint: "breakpoints" };
const MIN_THEMES_FOR_MODIFIER = 2;
const BREAKPOINTS_SECTION = "Breakpoints";
const QUERY_COLUMN = "Query";
const TOKENS_FILE = "tokens.json";

const fileOf = (kind, name) => `${FOLDERS[kind]}/${name}.json`;

/** The Resolver for these declarations as an object, or null when nothing asks for one.
 * `exists(file)` says whether a context file, relative to the folder of tokens.json, is there; a
 * context lists a file only then. The theme modifier is there from two themes on. The platform
 * and breakpoint modifiers are there once a context other than the first has a file; a breakpoint
 * context is written for the first and those, the query of each in the modifier's extension.
 * Contexts follow the declared order, which the `@media` blocks take. */
function resolverOf({ themes, platforms, breakpoints, queries, exists }) {
  const modifiers = {};
  const order = [{ $ref: "#/sets/base" }];
  const add = (kind, modifier) => {
    modifiers[MODIFIERS[kind]] = modifier;
    order.push({ $ref: `#/modifiers/${MODIFIERS[kind]}` });
  };
  const contextsOf = (kind, names) => Object.fromEntries(names.map((name, at) => [name, at > 0 && exists(fileOf(kind, name)) ? [{ $ref: fileOf(kind, name) }] : []]));
  const held = (kind, names) => names.slice(1).filter((name) => exists(fileOf(kind, name)));
  if (themes.length >= MIN_THEMES_FOR_MODIFIER) add("theme", { default: themes[0], contexts: contextsOf("theme", themes) });
  if (held("platform", platforms).length) add("platform", { default: platforms[0], contexts: contextsOf("platform", platforms) });
  const placed = held("breakpoint", breakpoints);
  if (placed.length) {
    const names = [breakpoints[0], ...placed];
    const extension = Object.fromEntries(placed.filter((name) => queries[name]).map((name) => [name, queries[name]]));
    add("breakpoint", { default: breakpoints[0], contexts: contextsOf("breakpoint", names), $extensions: { [MEDIA_EXTENSION]: extension } });
  }
  return order.length > 1 ? { version: RESOLVER_VERSION, sets: { base: { sources: [{ $ref: TOKENS_FILE }] } }, modifiers, resolutionOrder: order } : null;
}

/** The Resolver of a loaded project, from its `system.md` and the files on disk; null when it has
 * no `system.md` or nothing asks for one. A breakpoint's query is its `## Breakpoints` row's `Query`. */
function resolverOfProject(project) {
  const system = systemOf(project);
  if (!system) return null;
  const [themes, platforms, breakpoints] = ["themes", "platforms", "breakpoints"].map((key) => list(fm(system)[key]));
  const queries = Object.fromEntries(table(system.sections[BREAKPOINTS_SECTION]).map((row) => [row.Name, row[QUERY_COLUMN]]));
  const dir = path.join(project.root, path.posix.dirname(project.tokensFile));
  return resolverOf({ themes, platforms, breakpoints, queries, exists: (file) => fs.existsSync(path.join(dir, file)) });
}

/** The Resolver as it is written to disk. */
const textOf = (resolver) => `${JSON.stringify(resolver, null, 2)}\n`;

/** Writes the Resolver beside tokens.json; returns whether there was one to write. */
function writeResolver(project) {
  const resolver = resolverOfProject(project);
  if (resolver === null) return false;
  fs.writeFileSync(path.join(project.root, path.posix.dirname(project.tokensFile), RESOLVER_FILE), textOf(resolver));
  return true;
}

module.exports = { MIN_THEMES_FOR_MODIFIER, resolverOf, resolverOfProject, writeResolver, textOf, fileOf, RESOLVER_FILE, RESOLVER_VERSION, MEDIA_EXTENSION, MODIFIERS, FOLDERS };
