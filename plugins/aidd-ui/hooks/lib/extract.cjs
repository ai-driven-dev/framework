// Reads the files `system.md` names as `code-tokens` and writes the tokens they hold as the token
// files the T rules read: tokens.json, a file per theme, platform and breakpoint, and the Resolver
// naming them. It reads the custom properties of `:root`, `[data-theme]` and `@media :root` blocks and
// the object literals a script exports, and lists what it leaves rather than guess it.
const fs = require("node:fs");
const path = require("node:path");
const { list, table } = require("./markdown.cjs");
const { systemOf, fm } = require("./model.cjs");
const { load, text, UI_DIR } = require("./project.cjs");
const { tokenEntries, platformOfFile } = require("./code.cjs");
const { rulesOf, declarationsIn, RAW_CSS_EXTENSION } = require("./css.cjs");
const { RESOLVER_FILE, RESOLVER_VERSION, MEDIA_EXTENSION, MODIFIERS } = require("./tokens.cjs");
const { objectsOf } = require("./script.cjs");
const { fromCss, fromNumber, citedProperties } = require("./values.cjs");
const { Refusal } = require("./args.cjs");

const TOKENS_FILE = "tokens.json";
const BREAKPOINTS_SECTION = "Breakpoints";
const STYLE_EXTENSION = ".css";
const SCRIPT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"];
const ROOT_SELECTORS = [":root", "html"];
const THEME_SELECTOR = /^(?:html)?\[data-theme=["']?([\w-]+)["']?\]$/;
const WIDTH_QUERY = /\b(?:min|max)-width\b/;
const LENGTH = /(?<![\d.])\d*\.?\d+(?:px|rem|em)\b/g;
const WHITESPACE = /\s+/g;
const CAPITAL = /[A-Z]/g;
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;
const DASHES = "--";
const NAME_SEPARATOR = "-";
const PATH_SEPARATOR = ".";
const PREVIEW = 40;
const FOLDERS = { theme: "themes", platform: "platforms", breakpoint: "breakpoints" };
const BASE = { kind: "base" };

/** A script key as the CSS name part it stands for: `colorAccent` is `color-accent`. */
const kebab = (key) => key.replace(CAPITAL, (letter) => `${NAME_SEPARATOR}${letter.toLowerCase()}`);
const collapse = (value) => value.trim().replace(WHITESPACE, " ");
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // by code unit, the same order on every machine
const unique = (items, keyOf) => items.filter((item, at) => items.findIndex((other) => keyOf(other) === keyOf(item)) === at);

/** What a node is, whatever file or context it came from: two nodes with one key hold one value. */
const sameKey = (node) => JSON.stringify([node.kind, node.type, node.value, node.alias, node.raw]);

/** The context a selector stands for in a token file: the base, or a theme; null for any other. */
function contextOf(selector) {
  if (ROOT_SELECTORS.includes(selector)) return BASE;
  const theme = THEME_SELECTOR.exec(selector);
  return theme ? { kind: "theme", name: theme[1] } : null;
}

/** The custom properties of a stylesheet as `{line, name, node, context}`, a context being the base,
 * a theme or an `@media` query; what no context holds goes to `leave`. */
function readStyles(source, baseTheme, leave) {
  const found = [];
  const { rules, others } = rulesOf(source);
  const leaveAll = (declarations, why) => declarations.forEach(({ line, name }) => leave(line, name, why));
  for (const rule of rules) {
    const declarations = declarationsIn(rule.body, rule.bodyLine);
    const contexts = unique(rule.selector.split(",").map((selector) => contextOf(selector.trim())), JSON.stringify);
    const shown = collapse(rule.selector);
    // A theme's selector beside :root's, as the stylesheet writes the base, names the context twice.
    const kept = contexts.filter((context) => context === null || context.kind !== "theme" || context.name !== baseTheme);
    let placed = [];
    if (contexts.includes(null)) leaveAll(declarations, `selector "${shown}" is no :root, html or [data-theme] block`);
    else if (rule.media !== null) {
      if (contexts.every((context) => context.kind === BASE.kind)) placed = [{ kind: "media", query: collapse(rule.media) }];
      else leaveAll(declarations, `selector "${shown}" inside @media is no :root or html block`);
    } else if (kept.length < contexts.length && !contexts.includes(BASE)) leaveAll(declarations, `theme "${baseTheme}" is the base, held by :root: its own block is not merged`);
    else placed = kept;
    for (const context of placed) {
      for (const { line, name, value } of declarations) {
        if (value) found.push({ line, name, node: fromCss(value), context });
        else leave(line, name, "no value");
      }
    }
  }
  for (const other of others) {
    for (const rule of rulesOf(other.body).rules) leaveAll(declarationsIn(rule.body, other.bodyLine + rule.bodyLine - 1), `inside ${collapse(other.prelude)}`);
  }
  return found;
}

/** The literals of a script's exported objects as `{line, name, node, context}`. A key is a CSS
 * name part, its parent's joined to it with a dash; the export's own name is no part of it. */
function readScript(source, leave) {
  const found = [];
  const add = (entry, name, nested) => {
    if (entry.kind === "string") found.push({ line: entry.line, name, node: fromCss(entry.value), context: BASE });
    else if (entry.kind === "number") found.push({ line: entry.line, name, node: fromNumber(name.slice(DASHES.length), entry.value), context: BASE });
    else if (entry.kind === "object" && !nested) for (const child of entry.entries) add(child, child.key ? `${name}${NAME_SEPARATOR}${kebab(child.key)}` : "", true);
    else leave(entry.line, name || null, entry.kind === "object" ? "an object nested deeper than one level" : `not a string or number literal: ${entry.text.slice(0, PREVIEW)}`);
  };
  for (const { entries } of objectsOf(source)) for (const entry of entries) add(entry, entry.key ? `${DASHES}${kebab(entry.key)}` : "", false);
  return found;
}

const mentions = (words, length) => new RegExp(`(?<![\\d.])${length.replace(REGEX_SPECIALS, "\\$&")}(?!\\w)`).test(words);

/** Each width query's breakpoint among system.md's but the first, which is the default: the one
 * whose `## Breakpoints` row holds every length the query names and no other query's, else the next
 * free one in order when as many breakpoints are left as queries. */
function placeQueries(queries, project, breakpoints) {
  const rows = table(systemOf(project).sections[BREAKPOINTS_SECTION]);
  const widthOf = (name) => rows.find((row) => row.Name === name)?.Width ?? "";
  const open = breakpoints.slice(1);
  const placed = new Map();
  const free = () => open.filter((name) => ![...placed.values()].includes(name));
  let todo = queries.filter((query) => WIDTH_QUERY.test(query));
  for (let grew = true; grew; ) {
    grew = false;
    for (const query of todo) {
      const lengths = query.match(LENGTH) ?? [];
      const fitting = free().filter((name) => lengths.length > 0 && lengths.every((length) => mentions(widthOf(name), length)));
      if (fitting.length === 1) {
        placed.set(query, fitting[0]);
        grew = true;
      }
    }
    todo = todo.filter((query) => !placed.has(query));
  }
  if (todo.length > 0 && todo.length === free().length) todo.forEach((query, at) => placed.set(query, free()[0]));
  return placed;
}

/** Each CSS name's path in the token tree. `--a-b-c` is `a.b.c`; when a shorter name is already a
 * token, the rest joins its leaf, `--a-b` and `--a-b-c` being `a.b` and `a.b-c`, so that a path
 * gives its CSS name back. Shorter names go first: the result never depends on the order read. */
function pathsOf(names) {
  const paths = new Map();
  const bare = names.map((name) => name.slice(DASHES.length));
  bare.sort((a, b) => a.split(NAME_SEPARATOR).length - b.split(NAME_SEPARATOR).length || compare(a, b));
  for (const name of bare) {
    const parts = name.split(NAME_SEPARATOR);
    let cut = parts.length - 1;
    while (cut > 0 && !paths.has(parts.slice(0, cut).join(NAME_SEPARATOR))) cut -= 1;
    const prefix = paths.get(parts.slice(0, cut).join(NAME_SEPARATOR));
    paths.set(name, prefix ? [...prefix.slice(0, -1), `${prefix.at(-1)}${NAME_SEPARATOR}${parts.slice(cut).join(NAME_SEPARATOR)}`] : parts);
  }
  return new Map([...paths].map(([name, found]) => [`${DASHES}${name}`, found]));
}

/** The base tokens and the contexts, from every file read: `base` maps each CSS name to its entry,
 * `contexts` lists `{kind, name, query?, entries}` for each platform but the first, each theme and
 * each breakpoint that holds a token. A token held by only some of the platforms read is kept in
 * the base and listed. */
function gather(project, sources, leave) {
  const system = fm(systemOf(project));
  const [themes, platforms, breakpoints] = ["themes", "platforms", "breakpoints"].map((key) => list(system[key]));
  const basePlatform = platforms[0] ?? null;
  const [held, themed, queried] = [new Map(), new Map(), new Map()]; // by platform, by theme, by media query
  const put = (map, key, entry) => map.set(key, (map.get(key) ?? new Map()).set(entry.name, entry));
  for (const { file, platform, source } of sources) {
    const at = (line, name, why) => leave(file, line, name, why);
    const read = path.extname(file) === STYLE_EXTENSION ? readStyles(source, themes[0], at) : readScript(source, at);
    for (const entry of read.map((each) => ({ ...each, file }))) {
      const { kind, name, query } = entry.context;
      const where = kind === "theme" ? `theme "${name}"` : `@media ${query}`;
      if (kind === BASE.kind) put(held, platform, entry);
      else if (platform !== basePlatform) at(entry.line, entry.name, `${where} of platform ${platform} is not extracted`);
      else if (kind === "theme" && !themes.includes(name)) at(entry.line, entry.name, `${where} is not in system.md themes`);
      else put(kind === "theme" ? themed : queried, kind === "theme" ? name : query, entry);
    }
  }
  const base = new Map(held.get(basePlatform));
  for (const map of held.values()) for (const [name, entry] of map) if (!base.has(name)) base.set(name, entry);
  for (const [name, entry] of base) {
    const holders = [...held.keys()].filter((platform) => held.get(platform).has(name));
    if (holders.length < held.size) leave(entry.file, entry.line, name, `held by ${holders.join(", ")} only${holders.includes(basePlatform) ? "" : ", kept in the base"}`);
  }
  const placed = placeQueries([...queried.keys()], project, breakpoints);
  for (const [query, map] of queried) {
    if (placed.has(query)) continue;
    for (const entry of map.values()) leave(entry.file, entry.line, entry.name, WIDTH_QUERY.test(query) ? `@media ${query} matches no breakpoint of system.md` : `@media ${query} is no min-width or max-width query`);
  }
  const contexts = [
    ...[...held.keys()].filter((platform) => platform !== basePlatform).map((name) => ({ kind: "platform", name, entries: held.get(name) })),
    ...themes.filter((name) => themed.has(name)).map((name) => ({ kind: "theme", name, entries: themed.get(name) })),
    ...breakpoints.filter((name) => [...placed.values()].includes(name)).map((name) => {
      const query = [...placed].find(([, each]) => each === name)[0];
      return { kind: "breakpoint", name, query, entries: queried.get(query) };
    }),
  ];
  return { base, contexts, themes, platforms, breakpoints };
}

const cites = (node) => (node.kind === "alias" ? [node.alias] : node.kind === "raw" ? citedProperties(node.raw) : []);

/** Drops what the token files cannot hold: a context entry equal to the base's or setting a token the
 * base lacks, and any entry citing a custom property that is no token, which makes a token of the
 * base leave its contexts. What is dropped for a cause is listed. */
function prune({ base, contexts }, leave) {
  for (const context of contexts) {
    for (const [name, entry] of [...context.entries]) {
      if (!base.has(name)) leave(entry.file, entry.line, name, `${context.kind} "${context.name}" sets it, the base has no such token`);
      if (!base.has(name) || sameKey(entry.node) === sameKey(base.get(name).node)) context.entries.delete(name);
    }
  }
  for (let again = true; again; ) {
    again = false;
    for (const [name, entry] of base) {
      const missing = cites(entry.node).find((cited) => !base.has(cited));
      if (missing === undefined) continue;
      leave(entry.file, entry.line, name, `cites ${missing}, which is no token`);
      base.delete(name);
      again = true;
    }
    for (const context of contexts) {
      for (const [name, entry] of [...context.entries]) {
        const missing = cites(entry.node).find((cited) => !base.has(cited));
        if (missing !== undefined && base.has(name)) leave(entry.file, entry.line, name, `${context.kind} "${context.name}" cites ${missing}, which is no token`);
        if (missing !== undefined || !base.has(name)) context.entries.delete(name);
      }
    }
  }
}

/** A base token's `$type`: its own, else its alias target's; undefined for raw CSS with none. */
function typeOf(base, name, seen = new Set()) {
  const node = base.get(name)?.node;
  if (!node || seen.has(name)) return undefined;
  return node.kind === "alias" ? typeOf(base, node.alias, seen.add(name)) : node.type;
}

const rawNode = (css) => ({ $extensions: { [RAW_CSS_EXTENSION]: css } });

/** The DTCG form of an entry. A base token keeps its type; a context entry carries none, the base's
 * applies, so a value the base's type cannot hold stays CSS, as does an alias to another type, and
 * an alias to a token of no type, which no `$type` could resolve. */
function nodeOf({ base, paths }, name, node, inContext) {
  const baseType = typeOf(base, name);
  const target = node.kind === "alias" ? typeOf(base, node.alias) : undefined;
  const alias = () => ({ $value: `{${paths.get(node.alias).join(PATH_SEPARATOR)}}` });
  if (node.kind === "raw") return inContext ? rawNode(node.raw) : { ...(node.type ? { $type: node.type } : {}), ...rawNode(node.raw) };
  if (node.kind === "alias") {
    if (!inContext) return target === undefined ? rawNode(node.css) : alias();
    return target === undefined || baseType === undefined || baseType === target ? alias() : rawNode(node.css);
  }
  if (!inContext) return { $type: node.type, $value: node.value };
  return node.type === baseType ? { $value: node.value } : rawNode(node.css);
}

function setPath(tree, keys, node) {
  let at = tree;
  for (const key of keys.slice(0, -1)) at = at[key] ??= {};
  at[keys.at(-1)] = node;
}

/** The files to write, by path under `aidd_docs/ui/`, as objects. */
function filesOf(model) {
  const paths = pathsOf([...model.base.keys()]);
  const shared = { base: model.base, paths };
  const tree = (entries, inContext) => {
    const root = {};
    for (const [name, entry] of entries) setPath(root, paths.get(name), nodeOf(shared, name, entry.node, inContext));
    return root;
  };
  const files = new Map([[TOKENS_FILE, tree(model.base, false)]]);
  const written = (context) => `${FOLDERS[context.kind]}/${context.name}.json`;
  for (const context of model.contexts.filter((each) => each.entries.size)) files.set(written(context), tree(context.entries, true));
  const ref = (name, kind) => (files.has(`${FOLDERS[kind]}/${name}.json`) ? [{ $ref: `${FOLDERS[kind]}/${name}.json` }] : []);
  const contextsOf = (kind, names) => Object.fromEntries(names.map((name, at) => [name, at === 0 ? [] : ref(name, kind)]));
  const order = [{ $ref: "#/sets/base" }];
  const modifiers = {};
  const modify = (kind, modifier) => {
    modifiers[MODIFIERS[kind]] = modifier;
    order.push({ $ref: `#/modifiers/${MODIFIERS[kind]}` });
  };
  const { themes, platforms, breakpoints } = model;
  if (themes.length >= 2) modify("theme", { default: themes[0], contexts: contextsOf("theme", themes) });
  if (platforms.some((name, at) => at > 0 && files.has(`platforms/${name}.json`))) modify("platform", { default: platforms[0], contexts: contextsOf("platform", platforms) });
  const placed = model.contexts.filter((context) => context.kind === "breakpoint" && files.has(written(context)));
  if (placed.length) {
    const names = breakpoints.filter((name) => name === breakpoints[0] || placed.some((context) => context.name === name));
    modify("breakpoint", { default: breakpoints[0], contexts: contextsOf("breakpoint", names), $extensions: { [MEDIA_EXTENSION]: Object.fromEntries(placed.map((context) => [context.name, context.query])) } });
  }
  if (order.length > 1) files.set(RESOLVER_FILE, { version: RESOLVER_VERSION, sets: { base: { sources: [{ $ref: TOKENS_FILE }] } }, modifiers, resolutionOrder: order });
  return files;
}

const compareLeft = (a, b) => compare(a.file, b.file) || (a.line ?? 0) - (b.line ?? 0) || compare(a.name ?? "", b.name ?? "") || compare(a.why, b.why);

/** Writes the token files from the `code-tokens` of the project's `system.md` and returns
 * `{written, left}`. A refusal is a `Refusal`: nothing is written then. */
function extract(root, { force }) {
  const project = load(root);
  if (project === null) throw new Refusal(`no design system under ${UI_DIR}`, 1);
  if (!systemOf(project)) throw new Refusal(`${UI_DIR}/system.md is missing, write it first`, 1);
  const entries = tokenEntries(project);
  if (!entries.length) throw new Refusal("system.md lists no code-tokens", 1);
  if (fs.existsSync(path.join(root, project.tokensFile)) && !force) throw new Refusal(`${project.tokensFile} already exists, --force replaces it`, 1);
  const left = [];
  const leave = (file, line, name, why) => left.push({ file, line, name, why });
  const sources = [];
  for (const { path: file, named, platform: written } of entries) {
    const source = fs.existsSync(path.join(root, file)) && fs.statSync(path.join(root, file)).isFile() ? text(project, file) : null;
    if (source === null) throw new Refusal(`code-tokens "${file}" is no readable file`, 1);
    const { platform, unknown } = named ? { platform: written } : platformOfFile(project, file);
    if (path.extname(file) !== STYLE_EXTENSION && !SCRIPT_EXTENSIONS.includes(path.extname(file))) leave(file, null, null, "neither a stylesheet nor a script");
    else if (named && !list(fm(systemOf(project)).platforms).includes(written)) leave(file, null, null, `platform "${written}" is not in system.md`);
    else if (platform === null && list(fm(systemOf(project)).platforms).length > 1) leave(file, null, null, unknown ?? "its code root names no platform");
    else sources.push({ file, platform, source });
  }
  const model = gather(project, sources, leave);
  prune(model, leave);
  const output = filesOf(model);
  const dir = path.posix.dirname(project.tokensFile);
  for (const [name, tree] of output) {
    fs.mkdirSync(path.dirname(path.join(root, dir, name)), { recursive: true });
    fs.writeFileSync(path.join(root, dir, name), `${JSON.stringify(tree, null, 2)}\n`);
  }
  return { written: [...output.keys()].map((name) => path.posix.join(dir, name)), left: left.sort(compareLeft) };
}

module.exports = { extract, pathsOf };
