#!/usr/bin/env node
"use strict";
// Usage: node write-rule.cjs --project <abs dir> (--input <request.json> --tools <ids> | --remove <category>/<slug> | --publish [--tools <ids>]) [--plan] [--force] [--kilo-config <file>] [--opencode-config <file>]
// Tool ids: claude,cursor,copilot,antigravity,codex,opencode,kilo,kiro,kimi.
// Writes a rule source under aidd_docs/rules and publishes it to each host it targets.
// Exit 0 ok, 1 refusal, 2 usage error, 3 filesystem error. Prints one JSON object on stdout.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { createScanner, parseTree, SyntaxKind } = require("./lib/jsonc-parser.cjs");

const EXIT = { OK: 0, REFUSED: 1, USAGE: 2, FILESYSTEM: 3 };
const FLAGS = ["--publish", "--plan", "--force"];
const CONFIG_SELECTION = { kilo: "--kilo-config", opencode: "--opencode-config" };
const VALUES = ["--project", "--tools", "--input", "--remove", ...Object.values(CONFIG_SELECTION)];
const ACTIONS = ["--input", "--remove", "--publish"];
const REQUEST_KEYS = ["category", "slug", "description", "body", "paths", "nativeOptions"];
const CATEGORY_NAMES = ["architecture", "standards", "programming-languages", "frameworks-and-libraries", "tooling", "testing", "design-patterns", "quality", "domain", "other"];
const CATEGORIES = CATEGORY_NAMES.map((name, index) => `0${index}-${name}`);
const SLUG = /^\d-[a-z0-9]+(?:[-.@][a-z0-9]+)*$/;
const SLUG_PREFIX = /^\d-/;
const LINE_BREAK = /[\r\n]/;
const CRLF = /\r\n/g;
const GLOB_FORBIDDEN = /[,\r\n]/;
const TITLE_PREFIX = "# ";
const MISSING = ["ENOENT", "ENOTDIR"];

const SOURCE_DIR = "aidd_docs/rules";
const SOURCE_EXTENSION = ".md";
const FRONTMATTER_SOURCE = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/;
const SOURCE_LINE = { description: /^description: (.*)$/, glob: /^ {2}- (.*)$/, targets: /^targets: \[(.*)\]$/, paths: /^paths:$/, nativeOptions: /^nativeOptions: (.*)$/ };

const AGENTS = "AGENTS.md";
const INDEX_START = "<!-- aidd_rules:start -->";
const INDEX_END = "<!-- aidd_rules:end -->";
const INDEX_INTRO = "Before editing a file, read each rule whose scope matches it.";
const INDEX_MARK = /^<!-- aidd_rules:(start|end)(.*?)-->$/gm;
const INDEX_PRESENT = /^<!-- aidd_rules:start/m;
const FENCED_CODE = /^```[\s\S]*?^```/gm;
const TITLE_LINE = /^# (.+)$/m;

// Formats of earlier releases, converted on their next write.
const LEGACY_SOURCE = /^<!-- aidd_rule:([^\r\n]+) -->\n/;
const LEGACY_COPY_TRAILER = /\n<!-- aidd_rule_output:path=(\S+) sha256=([a-f0-9]{64}) -->\n$/;
const LEGACY_INDEX_SIGNATURE = /^ sha256=([a-f0-9]{64}) separator=([01]) $/;
const CURRENT_INDEX_SUFFIX = " ";

const quote = (value) => JSON.stringify(value);
const BRACE_GROUP = /\{([^{}]*,[^{}]*)\}/;
const isScoped = (rule) => rule.paths.length > 0;
const yamlList = (globs) => globs.map((glob) => `  - ${quote(glob)}\n`).join("");
const joinedGlobs = (rule) => quote(rule.paths.join(","));
const codeList = (globs) => globs.map((glob) => `\`${glob}\``).join(", ");

// A host reads a glob list with no brace syntax, so each `{a,b}` becomes one glob per alternative, innermost first.
function expandBraces(glob) {
  const group = BRACE_GROUP.exec(glob);
  if (!group) return [glob];
  const before = glob.slice(0, group.index);
  const after = glob.slice(group.index + group[0].length);
  return group[1].split(",").flatMap((alternative) => expandBraces(`${before}${alternative}${after}`));
}

// Each host's copy path and frontmatter, in `targets` order. Codex and Kimi have no rule files: they read a line of the root AGENTS.md index.
// Kilo also reads the OpenCode config, so a rule targeting both is published through OpenCode alone.
// Kilo and OpenCode ignore copy frontmatter and load copies only through a glob in a config's `instructions`; the first config is created when none exists.
const HOSTS = {
  claude: {
    path: (rule) => `.claude/rules/${rule.category}/${rule.slug}.md`,
    frontmatter: (rule) => (isScoped(rule) ? `paths:\n${yamlList(rule.paths)}` : ""),
    managedFields: ["paths"],
  },
  cursor: {
    path: (rule) => `.cursor/rules/${rule.category}/${rule.slug}.mdc`,
    frontmatter: (rule) => `description: ${quote(rule.description)}\n${isScoped(rule) ? `globs: ${rule.paths.join(", ")}\n` : ""}alwaysApply: ${!isScoped(rule)}\n`,
    managedFields: ["description", "globs", "alwaysApply"],
  },
  copilot: {
    path: (rule) => `.github/instructions/${rule.category.split("-")[0]}-${rule.slug.replace(SLUG_PREFIX, "")}.instructions.md`,
    frontmatter: (rule) => `applyTo: ${isScoped(rule) ? joinedGlobs(rule) : '"**"'}\n`,
    managedFields: ["applyTo"],
  },
  antigravity: {
    path: (rule) => `.agents/rules/${rule.slug}.md`,
    frontmatter: (rule) => `description: ${quote(rule.description)}\n${isScoped(rule) ? `trigger: glob\nglobs: ${joinedGlobs(rule)}\n` : "trigger: always_on\n"}`,
    managedFields: ["description", "trigger", "globs"],
    maxBytes: 24000,
  },
  codex: { indexed: true },
  kimi: { indexed: true },
  opencode: {
    path: (rule) => `.opencode/rules/${rule.category}-${rule.slug}.md`,
    config: { glob: ".opencode/rules/*.md", files: ["opencode.json", "opencode.jsonc"] },
  },
  kilo: {
    path: (rule) => `.kilo/rules/${rule.category}-${rule.slug}.md`,
    config: { glob: ".kilo/rules/*.md", files: ["kilo.jsonc", "kilo.json", ".kilo/kilo.jsonc", ".kilo/kilo.json"] },
  },
  kiro: {
    path: (rule) => `.kiro/steering/${rule.category}-${rule.slug}.md`,
    frontmatter: (rule) => `inclusion: ${isScoped(rule) ? `fileMatch\nfileMatchPattern: [${rule.paths.map(quote).join(", ")}]` : "always"}\n`,
    managedFields: ["inclusion", "fileMatchPattern"],
  },
};
const TOOLS = Object.keys(HOSTS);

class Refusal extends Error {}
class UsageError extends Error {}
const refuse = (message) => { throw new Refusal(message); };

// ---------- arguments ----------

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    const known = FLAGS.includes(name) || VALUES.includes(name);
    if (!known || name in options) throw new UsageError(`Bad option: ${name}`);
    if (FLAGS.includes(name)) {
      options[name] = true;
      continue;
    }
    const value = argv[++i];
    if (!value || value.startsWith("--")) throw new UsageError(`Missing value: ${name}`);
    options[name] = value;
  }
  assertOptionsConsistent(options);
  return options;
}

function assertOptionsConsistent(options) {
  if (!options["--project"]) throw new UsageError("--project is required.");
  if (ACTIONS.filter((name) => name in options).length !== 1) throw new UsageError(`Choose exactly one of ${ACTIONS.join(", ")}.`);
  if (options["--input"] && !options["--tools"]) throw new UsageError("--input requires --tools.");
}

function parseTools(list) {
  if (!Array.isArray(list) || list.some((tool) => !TOOLS.includes(tool))) refuse(`Unknown tool; expected ${TOOLS.join(",")}.`);
  return TOOLS.filter((tool) => list.includes(tool));
}

// ---------- rules ----------

const isSingleLine = (value) => typeof value === "string" && value.trim() !== "" && !LINE_BREAK.test(value);
const isGlob = (value) => typeof value === "string" && value !== "" && !GLOB_FORBIDDEN.test(value);
const isGlobRequest = (value) => typeof value === "string" && expandBraces(value).every(isGlob);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isNativeKey = (key) => /^[a-z][a-z0-9_-]*$/iu.test(key);

function isFiniteJson(value) {
  if (typeof value === "number") return Number.isFinite(value);
  return !value || typeof value !== "object" || Object.values(value).every(isFiniteJson);
}

function validateNativeOptions(options, targets) {
  if (!isObject(options)) refuse("nativeOptions must be an object keyed by selected tool.");
  for (const [tool, fields] of Object.entries(options)) {
    if (!targets.includes(tool)) refuse(`Native rule options supplied for unselected tool ${tool}.`);
    if (!isObject(fields)) refuse(`${tool} native rule options must be an object.`);
    if (!Object.keys(fields).length) continue;
    if (!HOSTS[tool].frontmatter) {
      if (HOSTS[tool].config && targets.includes("kilo") && targets.includes("opencode")) {
        refuse(`The shared Kilo and OpenCode rule copy has no native front matter for ${tool}.`);
      }
      refuse(`${tool} has no per-rule native fields.`);
    }
    for (const [field, value] of Object.entries(fields)) {
      if (!isNativeKey(field) || !isFiniteJson(value)) refuse(`Invalid native rule field ${tool}.${field}.`);
      if (HOSTS[tool].managedFields.includes(field)) refuse(`${tool}.${field} is managed by the rule writer.`);
      if (tool === "copilot" && field === "excludeAgent" && !["code-review", "cloud-agent"].includes(value)) {
        refuse("copilot.excludeAgent must be code-review or cloud-agent.");
      }
    }
  }
}

function validateRule(rule) {
  const categoryIndex = CATEGORIES.indexOf(rule.category);
  const slugMatches = typeof rule.slug === "string" && SLUG.test(rule.slug) && rule.slug[0] === String(categoryIndex);
  if (categoryIndex < 0 || !slugMatches) refuse("Invalid category or slug.");
  if (!isSingleLine(rule.description)) refuse("Description must be a non-empty single line.");
  if (typeof rule.body !== "string" || !rule.body.trim()) refuse("Body must be non-empty.");
  if (!Array.isArray(rule.paths) || !rule.paths.every(isGlobRequest)) refuse("Paths must be non-empty globs without a comma outside a brace group, or a newline.");
  const targets = parseTools(rule.targets);
  const nativeOptions = rule.nativeOptions === undefined ? {} : rule.nativeOptions;
  validateNativeOptions(nativeOptions, targets);
  return { ...rule, paths: [...new Set(rule.paths.flatMap(expandBraces))], targets, nativeOptions };
}

function parseJson(text, message) {
  try {
    return JSON.parse(text);
  } catch {
    return refuse(message);
  }
}

function readRequest(file) {
  let text;
  try {
    text = fs.readFileSync(path.resolve(file), "utf8");
  } catch {
    refuse("Input must be a readable JSON file.");
  }
  const request = parseJson(text, "Input must be a readable JSON file.");
  if (!isObject(request) || Object.keys(request).some((key) => !REQUEST_KEYS.includes(key))) refuse(`Request must be an object with ${REQUEST_KEYS.join(", ")}.`);
  return request;
}

const sourcePath = (rule) => `${SOURCE_DIR}/${rule.category}/${rule.slug}${SOURCE_EXTENSION}`;

function renderSource(rule) {
  const paths = isScoped(rule) ? `paths:\n${yamlList(rule.paths)}` : "";
  const configured = Object.fromEntries(Object.entries(rule.nativeOptions).filter(([, fields]) => Object.keys(fields).length));
  const native = Object.keys(configured).length ? `nativeOptions: ${quote(configured)}\n` : "";
  return `---\ndescription: ${quote(rule.description)}\n${paths}targets: [${rule.targets.join(", ")}]\n${native}---\n\n${rule.body}`;
}

function parseLegacySource(match, text, relativePath) {
  return { ...parseJson(match[1], `Unparseable source: ${relativePath}`), body: text.slice(match[0].length) };
}

function parseFrontmatterSource(match, relativePath) {
  const rule = { body: match[2], paths: [], targets: [] };
  const unparseable = `Unparseable source line in ${relativePath}.`;
  for (const line of match[1].split("\n")) {
    const description = SOURCE_LINE.description.exec(line);
    const glob = SOURCE_LINE.glob.exec(line);
    const targets = SOURCE_LINE.targets.exec(line);
    const nativeOptions = SOURCE_LINE.nativeOptions.exec(line);
    if (description) rule.description = parseJson(description[1], unparseable);
    else if (glob) rule.paths.push(parseJson(glob[1], unparseable));
    else if (targets) rule.targets = targets[1] ? targets[1].split(", ") : [];
    else if (nativeOptions && rule.nativeOptions === undefined) rule.nativeOptions = parseJson(nativeOptions[1], unparseable);
    else if (!SOURCE_LINE.paths.test(line)) refuse(unparseable);
  }
  [rule.category, rule.slug] = relativePath.slice(SOURCE_DIR.length + 1, -SOURCE_EXTENSION.length).split("/");
  return rule;
}

function parseSource(text, relativePath) {
  const legacy = LEGACY_SOURCE.exec(text);
  const current = FRONTMATTER_SOURCE.exec(text);
  let rule;
  if (legacy) rule = parseLegacySource(legacy, text, relativePath);
  else if (current) rule = parseFrontmatterSource(current, relativePath);
  else refuse(`Unrecognized source: ${relativePath}`);
  const valid = validateRule({ ...rule, paths: rule.paths ?? [], targets: rule.targets ?? [] });
  if (sourcePath(valid) !== relativePath) refuse(`Source path does not match its identity: ${relativePath}`);
  return valid;
}

function renderCopy(rule, tool) {
  const host = HOSTS[tool];
  const native = Object.entries(rule.nativeOptions[tool] ?? {}).map(([key, value]) => `${key}: ${quote(value)}\n`).join("");
  const frontmatter = (host.frontmatter?.(rule) ?? "") + native;
  const scopeLine = host.config && isScoped(rule) ? `Applies to files matching ${codeList(rule.paths)}.\n\n` : "";
  const text = (frontmatter ? `---\n${frontmatter}---\n` : "") + scopeLine + rule.body;
  if (host.maxBytes && Buffer.byteLength(text) > host.maxBytes) refuse(`The ${tool} rule exceeds ${host.maxBytes} bytes.`);
  return text;
}

const copyTools = (rule) => rule.targets.filter((tool) => HOSTS[tool].path && !(tool === "kilo" && rule.targets.includes("opencode")));
const isIndexed = (rule) => rule.targets.some((tool) => HOSTS[tool].indexed);
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

// A legacy copy ended with a sha256 trailer; only a valid one proves the writer produced it.
function isLegacySigned(text, relativePath) {
  const trailer = LEGACY_COPY_TRAILER.exec(text);
  return Boolean(trailer) && trailer[1] === relativePath && sha256(text.slice(0, trailer.index)) === trailer[2];
}

// ---------- AGENTS.md index ----------

function indexLines(sources) {
  return [...sources]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .filter(([, rule]) => isIndexed(rule))
    .map(([relativePath, rule]) => {
      const scope = isScoped(rule) ? codeList(rule.paths) : "all files";
      const title = TITLE_LINE.exec(rule.body.replace(FENCED_CODE, ""))?.[1].trim() || rule.slug;
      return `- ${scope}: [${title}](${relativePath})`;
    });
}

const indexBlock = (lines) => (lines.length ? `${INDEX_START}\n${INDEX_INTRO}\n\n${lines.join("\n")}\n${INDEX_END}\n` : "");

function separatorBefore(text) {
  if (!text || text.endsWith("\n\n")) return "";
  return text.endsWith("\n") ? "\n" : "\n\n";
}

// Where a signed legacy block begins, or null when its signature does not hold.
function legacyBlockStart(text, start, end) {
  const signature = LEGACY_INDEX_SIGNATURE.exec(start[2]);
  if (!signature) return null;
  const [, expectedHash, separator] = signature;
  const payload = text.slice(start.index + start[0].length + 1, end.index);
  if (sha256(`separator=${separator}\n${payload}`) !== expectedHash) return null;
  if (separator === "1" && text[start.index - 1] !== "\n") return null;
  return start.index - Number(separator);
}

// The AGENTS.md text holding these lines, or null when its existing block cannot be trusted.
function reindexAgents(text, lines) {
  const block = indexBlock(lines);
  const marks = [...text.matchAll(INDEX_MARK)];
  if (!marks.length) return block ? text + separatorBefore(text) + block : text;
  const [start, end] = marks;
  if (marks.length !== 2 || start[1] !== "start" || end[1] !== "end") return null;
  const markEnd = end.index + end[0].length;
  const blockEnd = markEnd + (text[markEnd] === "\n" ? 1 : 0);
  const isLegacy = start[2] !== CURRENT_INDEX_SUFFIX;
  const blockStart = isLegacy ? legacyBlockStart(text, start, end) : start.index;
  if (blockStart === null) return null;
  if (block) return text.slice(0, start.index) + block + text.slice(blockEnd);
  const prefix = text.slice(0, blockStart);
  const trimmed = !isLegacy && prefix.endsWith("\n\n") ? prefix.slice(0, -1) : prefix;
  return trimmed + text.slice(blockEnd);
}

// ---------- project reads ----------

function openProject(value) {
  const root = path.resolve(value);
  const isReal = path.isAbsolute(value) && fs.existsSync(root) && fs.statSync(root).isDirectory() && fs.realpathSync(root) === root;
  if (!isReal) refuse("--project must be an absolute real directory.");

  function resolve(relativePath) {
    const parts = relativePath.split("/");
    if (parts.some((part) => !part || part === "." || part === "..") || relativePath.includes("\\")) refuse(`Unsafe path: ${relativePath}`);
    let current = root;
    for (const part of parts) {
      current = path.join(current, part);
      if (isSymlink(current)) refuse(`Symlink in path: ${relativePath}`);
    }
    return current;
  }

  // A Windows checkout may turn every line ending into CRLF; the writer reads and writes LF.
  const readRaw = (relativePath) => orWhenMissing(() => fs.readFileSync(resolve(relativePath), "utf8"), null);
  const read = (relativePath) => readRaw(relativePath)?.replace(CRLF, "\n") ?? null;
  const list = (relativePath) => orWhenMissing(() => fs.readdirSync(resolve(relativePath)).sort(), []);
  return { resolve, read, readRaw, list };
}

function orWhenMissing(action, fallback) {
  try {
    return action();
  } catch (error) {
    if (MISSING.includes(error.code)) return fallback;
    throw error;
  }
}

const isSymlink = (file) => orWhenMissing(() => fs.lstatSync(file).isSymbolicLink(), false);

function loadSources(project) {
  const sources = new Map();
  for (const category of project.list(SOURCE_DIR)) {
    for (const name of project.list(`${SOURCE_DIR}/${category}`)) {
      if (!name.endsWith(SOURCE_EXTENSION)) continue;
      const relativePath = `${SOURCE_DIR}/${category}/${name}`;
      sources.set(relativePath, parseSource(project.read(relativePath), relativePath));
    }
  }
  return sources;
}

// ---------- planning: decides every write, delete and conflict, touches nothing ----------

// Targets only grow: --tools adds hosts to a rule, never drops one.
function collectItems(options, sources) {
  const tools = options["--tools"] ? parseTools(options["--tools"].split(",")) : [];
  if (options["--input"]) return [itemFromRequest(options["--input"], tools, sources)];
  if (options["--remove"]) return [itemFromRemoval(options["--remove"], sources)];
  return [...sources.values()].map((prior) => ({ rule: { ...prior, targets: parseTools([...prior.targets, ...tools]) }, prior }));
}

const withFinalNewline = (text) => (text.endsWith("\n") ? text : `${text}\n`);

function itemFromRequest(file, tools, sources) {
  const rule = validateRule({ paths: [], ...readRequest(file), targets: tools });
  if (!rule.body.startsWith(TITLE_PREFIX)) refuse("Body must start with a `# <title>` line.");
  const prior = sources.get(sourcePath(rule));
  const targets = parseTools([...(prior ? prior.targets : []), ...tools]);
  return { rule: { ...rule, body: withFinalNewline(rule.body), targets, nativeOptions: { ...prior?.nativeOptions, ...rule.nativeOptions } }, prior };
}

function itemFromRemoval(identity, sources) {
  const prior = sources.get(`${SOURCE_DIR}/${identity}${SOURCE_EXTENSION}`);
  if (!prior) refuse("Cannot remove an absent rule.");
  return { rule: prior, prior, deleting: true };
}

function planChanges(project, options) {
  const sources = loadSources(project);
  const items = collectItems(options, sources);
  const plan = { writes: new Map(), conflicts: [] };
  const finalSources = planRuleFiles(plan, project, items, sources);
  for (const [tool, selection] of Object.entries(CONFIG_SELECTION)) {
    const targeted = items.some((item) => !item.deleting && copyTools(item.rule).includes(tool));
    const selected = options[selection];
    if (selected && !targeted) refuse(`${selection} requires a published ${tool} rule.`);
    if (targeted) planConfig(plan, project, HOSTS[tool].config, selection, selected);
  }
  // An existing block is rebuilt too, so lines for hosts that now take copies disappear.
  const indexed = items.some((item) => isIndexed(item.rule));
  if (indexed || INDEX_PRESENT.test(project.read(AGENTS) ?? "")) planIndex(plan, project, finalSources, indexed);
  return plan;
}

function planChange(plan, relativePath, current, wanted) {
  if (current !== wanted) plan.writes.set(relativePath, { current, wanted });
}

function planRuleFiles(plan, project, items, sources) {
  const finalSources = new Map(sources);
  for (const { rule, prior, deleting } of items) {
    const relativePath = sourcePath(rule);
    if (deleting) finalSources.delete(relativePath);
    else finalSources.set(relativePath, rule);
    planChange(plan, relativePath, project.read(relativePath), deleting ? null : renderSource(rule));
    for (const tool of copyTools(rule)) {
      const wanted = deleting ? null : renderCopy(rule, tool);
      const previous = prior && renderCopy(prior, tool);
      planCopy(plan, project, HOSTS[tool].path(rule), wanted, previous);
    }
    if (!deleting) planSupersededKiloCopy(plan, project, rule, prior);
  }
  return finalSources;
}

// A Kilo copy the writer produced before OpenCode was targeted would load a second time, so it goes.
function planSupersededKiloCopy(plan, project, rule, prior) {
  const superseded = rule.targets.includes("kilo") && !copyTools(rule).includes("kilo");
  if (superseded && prior?.targets.includes("kilo")) planCopy(plan, project, HOSTS.kilo.path(rule), null, renderCopy(prior, "kilo"));
}

// A copy is the writer's when absent, legacy-signed or what the prior source rendered; any other differing copy conflicts.
function planCopy(plan, project, relativePath, wanted, previous) {
  const current = project.read(relativePath);
  if (current === wanted) return;
  const produced = current === null || current === previous || isLegacySigned(current, relativePath);
  if (!produced) plan.conflicts.push(relativePath);
  planChange(plan, relativePath, current, wanted);
}

// An untrusted block refuses only an operation that must index; any other leaves it alone.
function planIndex(plan, project, finalSources, required) {
  const current = project.read(AGENTS);
  const next = reindexAgents(current ?? "", indexLines(finalSources));
  if (next === null && required) refuse(`${AGENTS} has an aidd_rules block the writer cannot trust; repair or remove it by hand.`);
  if (next !== null) planChange(plan, AGENTS, current, next || null);
}

function readConfig(file, text, glob) {
  const errors = [];
  const root = parseTree(text, errors, { allowTrailingComma: true });
  if (errors.length || root?.type !== "object") refuse(`${file} must be a valid JSON or JSONC object.`);
  const fields = root.children.filter((property) => property.children[0].value === "instructions");
  const instructions = fields[0]?.children[1];
  if (fields.length > 1 || (instructions && (instructions.type !== "array" || instructions.children.some((item) => item.type !== "string")))) {
    refuse(`${file} must have at most one "instructions" field, an array of strings, before adding ${quote(glob)}.`);
  }
  return { file, text, root, instructions };
}

const hasGlob = (config, glob) => config.instructions?.children.some((item) => item.value === glob);
const lineStart = (text, offset) => text.lastIndexOf("\n", offset - 1) + 1;
const whitespace = /^[ \t]*$/;

// Insert around the AST offsets so comments, line endings and all existing entries remain in place.
function appendConfigEntry(text, container, entry) {
  const last = container.children.at(-1);
  const from = last ? last.offset + last.length : container.offset + 1;
  const close = container.offset + container.length - 1;
  const tail = text.slice(from, close);
  const trailing = createScanner(tail, true).scan() === SyntaxKind.CommaToken;
  const separator = last && !trailing ? "," : "";
  const closingLine = lineStart(text, close);
  const closingIndent = text.slice(closingLine, close);
  if (closingLine >= from && whitespace.test(closingIndent)) {
    const lastIndent = last ? text.slice(lineStart(text, last.offset), last.offset) : null;
    const indent = lastIndent !== null && whitespace.test(lastIndent) ? lastIndent : closingIndent + (closingIndent.includes("\t") ? "\t" : "  ");
    const eol = text[closingLine - 2] === "\r" ? "\r\n" : "\n";
    return text.slice(0, from) + separator + text.slice(from, closingLine) + indent + entry + (trailing ? "," : "") + eol + text.slice(closingLine);
  }
  const space = (last || tail) && !/\s$/.test(tail) ? " " : "";
  return text.slice(0, from) + separator + tail + space + entry + (trailing ? "," : "") + text.slice(close);
}

// The config is never a conflict and never cleaned up: a glob matching no rule is harmless.
function planConfig(plan, project, config, selection, selected) {
  const entry = quote(config.glob);
  const found = config.files.map((file) => [file, project.readRaw(file)])
    .filter(([, text]) => text !== null)
    .map(([file, text]) => readConfig(file, text, config.glob));
  const chosen = selected && found.find(({ file }) => file === selected);
  if (selected && !chosen) refuse(`${selection} must name an existing config: ${config.files.join(", ")}.`);
  const existing = found.find((candidate) => hasGlob(candidate, config.glob));
  if (existing) {
    if (chosen && !hasGlob(chosen, config.glob)) refuse(`${entry} is already in ${existing.file}.`);
    return;
  }
  if (!found.length) {
    planChange(plan, config.files[0], null, `{\n  "instructions": [${entry}]\n}\n`);
    return;
  }
  if (found.length > 1 && !chosen) refuse(`Choose a config with ${selection}: ${found.map(({ file }) => file).join(" and ")}.`);
  const { file, text, root, instructions } = chosen || found[0];
  const next = appendConfigEntry(text, instructions ?? root, instructions ? entry : `"instructions": [${entry}]`);
  planChange(plan, file, text, next);
}

// ---------- effects ----------

function operationOf({ current, wanted }) {
  if (wanted === null) return "delete";
  return current === null ? "create" : "update";
}

function toOperations(project, writes) {
  return [...writes].map(([relativePath, change]) => ({ path: relativePath, file: project.resolve(relativePath), operation: operationOf(change), text: change.wanted }));
}

function nearestExisting(file) {
  let candidate = file;
  while (!fs.existsSync(candidate)) candidate = path.dirname(candidate);
  return candidate;
}

// Only the parent directory must be writable; a delete needs its own parent, a write the nearest one that exists.
function assertParentWritable(operation) {
  const parent = path.dirname(operation.file);
  const directory = operation.operation === "delete" ? parent : nearestExisting(parent);
  if (!fs.statSync(directory).isDirectory()) throw Object.assign(new Error(`${directory} is not a directory`), { code: "ENOTDIR" });
  fs.accessSync(directory, fs.constants.W_OK);
}

// Every path is checked before the first write, so a blocked one fails with nothing written.
function assertWritable(operations) {
  const blocked = [];
  for (const operation of operations) {
    try {
      assertParentWritable(operation);
    } catch (error) {
      blocked.push({ path: operation.path, code: error.code });
    }
  }
  if (!blocked.length) return;
  const list = blocked.map((entry) => `${entry.path} (${entry.code})`).join(", ");
  throw Object.assign(new Error(`Not writable, nothing written: ${list}.`), { code: blocked[0].code });
}

function perform(operation) {
  try {
    if (operation.operation === "delete") {
      fs.rmSync(operation.file, { force: true });
      return;
    }
    fs.mkdirSync(path.dirname(operation.file), { recursive: true });
    fs.writeFileSync(operation.file, operation.text);
  } catch (error) {
    throw Object.assign(new Error(`${operation.operation} failed on ${operation.path}: ${error.message}`), { code: error.code });
  }
}

function applyPlan(operations, conflicts, force) {
  if (conflicts.length && !force) refuse(`Would overwrite ${conflicts.join(", ")}, which the writer did not produce; rerun with --force once approved.`);
  assertWritable(operations);
  for (const operation of operations) perform(operation);
}

// ---------- output ----------

function main(argv) {
  const options = parseArgs(argv);
  const project = openProject(options["--project"]);
  const plan = planChanges(project, options);
  const operations = toOperations(project, plan.writes);
  if (!options["--plan"]) applyPlan(operations, plan.conflicts, options["--force"]);
  return { files: operations.map((operation) => ({ path: operation.path, operation: operation.operation })), conflicts: plan.conflicts };
}

function failureOf(error) {
  if (error instanceof UsageError) return { code: EXIT.USAGE, error: { code: "USAGE", message: error.message } };
  if (error instanceof Refusal) return { code: EXIT.REFUSED, error: { code: "REFUSED", message: error.message } };
  if (error.code) return { code: EXIT.FILESYSTEM, error: { code: error.code, message: error.message } };
  throw error;
}

function run() {
  try {
    process.stdout.write(`${JSON.stringify(main(process.argv.slice(2)), null, 2)}\n`);
    process.exitCode = EXIT.OK;
  } catch (thrown) {
    const failure = failureOf(thrown);
    process.stdout.write(`${JSON.stringify({ error: failure.error }, null, 2)}\n`);
    process.exitCode = failure.code;
  }
}

if (require.main === module) run();

module.exports = { TOOLS };
