#!/usr/bin/env node
"use strict";
// Usage: node write-rule.cjs --project <abs dir> (--input <request.json> --tools <ids> | --remove <category>/<slug> | --publish [--tools <ids>]) [--plan | --check] [--force]
// Tool ids: claude,cursor,copilot,antigravity,codex,opencode. --tools adds hosts to the rules it publishes; --check takes none.
// Publishes aidd_docs/rules sources as native copies.
// Exit 0 ok, 1 refusal/conflict/drift/unexpected error, 2 usage error, 3 filesystem blocked or failed.
// Every non-zero exit prints a JSON object on stdout.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const TOOLS = ["claude", "cursor", "copilot", "antigravity", "codex", "opencode"];
const CATEGORIES = ["architecture", "standards", "programming-languages", "frameworks-and-libraries", "tooling", "testing", "design-patterns", "quality", "domain", "other"].map((name, index) => `0${index}-${name}`);
const SOURCE_DIR = "aidd_docs/rules";
// Hosts without native rules read a line of the root AGENTS.md index instead of a copy.
const INDEX_TOOLS = ["codex", "opencode"];
const FLAG_OPTIONS = ["--publish", "--plan", "--check", "--force"];
const VALUE_OPTIONS = ["--project", "--tools", "--input", "--remove"];
const REQUEST_KEYS = ["category", "slug", "description", "body", "paths"];
const ANTIGRAVITY_MAX_BYTES = 24000;
const EXIT = { OK: 0, REFUSED: 1, USAGE: 2, FILESYSTEM: 3 };

class Refusal extends Error {}
class UsageError extends Error {}

function refuse(message) {
  throw new Refusal(message);
}

function rejectUsage(message) {
  throw new UsageError(message);
}

// ---------- pure helpers ----------

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const isUtf8 = (text) => Buffer.from(text).toString("utf8") === text;
const isMissing = (error) => error.code === "ENOENT" || error.code === "ENOTDIR";
const quote = (value) => JSON.stringify(value);

function parseTools(list) {
  if (!Array.isArray(list) || list.some((tool) => !TOOLS.includes(tool))) refuse(`Unknown tool; expected ${TOOLS.join(",")}.`);
  return TOOLS.filter((tool) => list.includes(tool));
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    const isFlag = FLAG_OPTIONS.includes(name);
    if (!(isFlag || VALUE_OPTIONS.includes(name)) || name in options) rejectUsage(`Bad option: ${name}`);
    if (isFlag) {
      options[name] = true;
      continue;
    }
    const value = argv[++i];
    if (!value || value.startsWith("--")) rejectUsage(`Missing value: ${name}`);
    options[name] = value;
  }
  assertOptionsConsistent(options);
  return options;
}

function assertOptionsConsistent(options) {
  if (!options["--project"]) rejectUsage("--project is required.");
  const actions = ["--input", "--remove", "--publish"].filter((name) => name in options);
  if (actions.length !== 1) rejectUsage("Choose exactly one of --input, --remove, --publish.");
  if (options["--input"] && !options["--tools"]) rejectUsage("--input requires --tools.");
  if (options["--remove"] && options["--tools"]) rejectUsage("--remove takes no --tools.");
  if (options["--check"] && (!options["--publish"] || options["--plan"] || options["--tools"])) rejectUsage("--check applies to --publish only, without --plan or --tools.");
}

function validateRule(rule) {
  const categoryIndex = CATEGORIES.indexOf(rule.category);
  const slugPattern = /^\d-[a-z0-9]+(?:[-.@][a-z0-9]+)*$/;
  if (categoryIndex < 0 || typeof rule.slug !== "string" || !slugPattern.test(rule.slug) || rule.slug[0] !== String(categoryIndex)) refuse("Invalid category or slug.");
  if (typeof rule.description !== "string" || !rule.description.trim() || /[\r\n]/.test(rule.description)) refuse("Description must be a non-empty single line.");
  if (typeof rule.body !== "string" || !rule.body.trim()) refuse("Body must be non-empty.");
  if (!Array.isArray(rule.paths) || rule.paths.some((glob) => typeof glob !== "string" || !glob || /[,\r\n]/.test(glob))) refuse("Paths must be non-empty strings without commas or newlines.");
  if (![rule.body, rule.description, ...rule.paths].every(isUtf8)) refuse("Text must be valid UTF-8.");
  return { ...rule, targets: parseTools(rule.targets) };
}

function parseRequest(text) {
  const request = JSON.parse(text);
  if (!request || typeof request !== "object" || Object.keys(request).some((key) => !REQUEST_KEYS.includes(key))) refuse(`Request must be an object with ${REQUEST_KEYS.join(", ")}.`);
  return request;
}

function sourcePath(rule) {
  return `${SOURCE_DIR}/${rule.category}/${rule.slug}.md`;
}

function yamlPaths(paths) {
  return paths.map((glob) => `  - ${quote(glob)}\n`).join("");
}

function renderSource(rule) {
  const paths = rule.paths.length ? `paths:\n${yamlPaths(rule.paths)}` : "";
  return `---\ndescription: ${quote(rule.description)}\n${paths}targets: [${rule.targets.join(", ")}]\n---\n\n${rule.body}`;
}

function parseLegacySource(match, text) {
  return { ...JSON.parse(match[1]), body: text.slice(match[0].length), legacy: true };
}

function parseFrontmatterSource(match, relativePath) {
  const rule = { body: match[2], paths: [], targets: [] };
  for (const line of match[1].split("\n")) {
    const description = /^description: (.*)$/.exec(line);
    const glob = /^  - (.*)$/.exec(line);
    const targets = /^targets: \[(.*)\]$/.exec(line);
    if (description) rule.description = JSON.parse(description[1]);
    else if (glob) rule.paths.push(JSON.parse(glob[1]));
    else if (targets) rule.targets = targets[1] ? targets[1].split(", ") : [];
    else if (line !== "paths:") refuse(`Unparseable source line in ${relativePath}.`);
  }
  [rule.category, rule.slug] = relativePath.slice(SOURCE_DIR.length + 1, -".md".length).split("/");
  return rule;
}

function parseSource(text, relativePath) {
  const legacyMatch = /^<!-- aidd_rule:([^\r\n]+) -->\n/.exec(text);
  const frontmatterMatch = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/.exec(text);
  let rule;
  if (legacyMatch) rule = parseLegacySource(legacyMatch, text);
  else if (frontmatterMatch) rule = parseFrontmatterSource(frontmatterMatch, relativePath);
  else refuse(`Unrecognized source: ${relativePath}`);
  const valid = validateRule({ ...rule, paths: rule.paths ?? [], targets: rule.targets ?? [] });
  if (sourcePath(valid) !== relativePath) refuse(`Source path does not match its identity: ${relativePath}`);
  return valid;
}

function nativePath(rule, tool) {
  if (tool === "claude") return `.claude/rules/${rule.category}/${rule.slug}.md`;
  if (tool === "cursor") return `.cursor/rules/${rule.category}/${rule.slug}.mdc`;
  if (tool === "antigravity") return `.agents/rules/${rule.slug}.md`;
  return `.github/instructions/${rule.category.slice(0, 2)}-${rule.slug.slice(2)}.instructions.md`;
}

function renderNative(rule, tool) {
  const scoped = rule.paths.length > 0;
  const globs = quote(rule.paths.join(","));
  const frontmatter = {
    claude: scoped ? `paths:\n${yamlPaths(rule.paths)}` : "",
    cursor: `description: ${quote(rule.description)}\n${scoped ? `globs: ${rule.paths.join(", ")}\n` : ""}alwaysApply: ${!scoped}\n`,
    copilot: `applyTo: ${scoped ? globs : '"**"'}\n`,
    antigravity: `description: ${quote(rule.description)}\n${scoped ? `trigger: glob\nglobs: ${globs}\n` : "trigger: always_on\n"}`,
  }[tool];
  const text = (frontmatter ? `---\n${frontmatter}---\n` : "") + rule.body;
  if (tool === "antigravity" && Buffer.byteLength(text) > ANTIGRAVITY_MAX_BYTES) refuse(`Antigravity rule exceeds ${ANTIGRAVITY_MAX_BYTES} bytes.`);
  return text;
}

const isIndexed = (rule) => rule.targets.some((tool) => INDEX_TOOLS.includes(tool));
const copyTools = (targets) => targets.filter((tool) => !INDEX_TOOLS.includes(tool));

// Legacy copies ended with a sha256 trailer; only a valid one proves we wrote the file.
function isLegacySigned(text, relativePath) {
  const trailer = /\n<!-- aidd_rule_output:path=(\S+) sha256=([a-f0-9]{64}) -->\n$/.exec(text);
  return !!trailer && trailer[1] === relativePath && sha256(text.slice(0, trailer.index)) === trailer[2];
}

function separatorBefore(text) {
  if (text.endsWith("\n\n")) return "";
  if (text.endsWith("\n")) return "\n";
  return text ? "\n\n" : "";
}

// Returns where a signed legacy AGENTS.md block begins, or null when its signature does not hold.
function legacyBlockStart(text, startMark, endMark) {
  const signature = /^ sha256=([a-f0-9]{64}) separator=([01]) $/.exec(startMark[2]);
  if (!signature) return null;
  const [, expectedHash, separator] = signature;
  const payload = text.slice(startMark.index + startMark[0].length + 1, endMark.index);
  if (sha256(`separator=${separator}\n${payload}`) !== expectedHash) return null;
  if (separator === "1" && text[startMark.index - 1] !== "\n") return null;
  return startMark.index - Number(separator);
}

// Returns { text, legacy }, or null when the existing block cannot be trusted.
function reindexAgents(text, lines) {
  const marks = [...text.matchAll(/^<!-- aidd_rules:(start|end)(.*?)-->$/gm)];
  const block = lines.length ? `<!-- aidd_rules:start -->\nBefore editing a file, read each rule whose scope matches it.\n\n${lines.join("\n")}\n<!-- aidd_rules:end -->\n` : "";
  if (!marks.length) return { text: block ? text + separatorBefore(text) + block : text, legacy: false };
  const [startMark, endMark] = marks;
  if (marks.length !== 2 || startMark[1] !== "start" || endMark[1] !== "end") return null;
  const markEnd = endMark.index + endMark[0].length;
  const blockEnd = markEnd + (text[markEnd] === "\n" ? 1 : 0);
  const isLegacy = startMark[2] !== " ";
  const blockStart = isLegacy ? legacyBlockStart(text, startMark, endMark) : startMark.index;
  if (blockStart === null) return null;
  if (block) return { text: text.slice(0, startMark.index) + block + text.slice(blockEnd), legacy: isLegacy };
  const prefix = text.slice(0, blockStart);
  const trimmedPrefix = !isLegacy && prefix.endsWith("\n\n") ? prefix.slice(0, -1) : prefix;
  return { text: trimmedPrefix + text.slice(blockEnd), legacy: isLegacy };
}

function agentsIndexLines(sources) {
  return [...sources]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .filter(([, rule]) => isIndexed(rule))
    .map(([relativePath, rule]) => {
      const scope = rule.paths.length ? rule.paths.map((glob) => `\`${glob}\``).join(", ") : "all files";
      const title = /^# (.+)$/m.exec(rule.body.replace(/^```[\s\S]*?^```/gm, ""))?.[1].trim() || rule.slug;
      return `- ${scope}: [${title}](${relativePath})`;
    });
}

// ---------- project reads ----------

function readUtf8(file) {
  const bytes = fs.readFileSync(file);
  const text = bytes.toString("utf8");
  if (!Buffer.from(text).equals(bytes)) refuse(`Invalid UTF-8 in ${file}.`);
  return text;
}

function openProject(optionValue) {
  const root = path.resolve(optionValue);
  if (!path.isAbsolute(optionValue) || !fs.statSync(root).isDirectory() || fs.realpathSync(root) !== root) refuse("Project must be a real absolute directory.");

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

  function read(relativePath) {
    try {
      return readUtf8(resolve(relativePath));
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  function list(relativePath) {
    try {
      return fs.readdirSync(resolve(relativePath)).sort();
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
  }

  return { resolve, read, list };
}

function isSymlink(file) {
  try {
    return fs.lstatSync(file).isSymbolicLink();
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

function loadSources(project) {
  const sources = new Map();
  for (const category of project.list(SOURCE_DIR)) {
    for (const name of project.list(`${SOURCE_DIR}/${category}`)) {
      if (!name.endsWith(".md")) continue;
      const relativePath = `${SOURCE_DIR}/${category}/${name}`;
      sources.set(relativePath, parseSource(project.read(relativePath), relativePath));
    }
  }
  return sources;
}

// ---------- planning: decides writes, deletes and conflicts, touches nothing ----------

// Targets only grow: --tools adds hosts to a rule, never drops one.
function collectItems(options, sources) {
  const tools = options["--tools"] ? parseTools(options["--tools"].split(",")) : [];
  if (options["--input"]) return [itemFromRequest(options["--input"], tools, sources)];
  if (options["--remove"]) return [itemFromRemoval(options["--remove"], sources)];
  return [...sources.values()].map((prior) => ({ rule: { ...prior, targets: parseTools([...prior.targets, ...tools]) }, prior }));
}

function itemFromRequest(inputFile, tools, sources) {
  const request = parseRequest(readUtf8(path.resolve(inputFile)));
  const rule = validateRule({ paths: [], ...request, targets: tools });
  const prior = sources.get(sourcePath(rule));
  return { rule: { ...rule, targets: parseTools([...(prior ? prior.targets : []), ...tools]) }, prior };
}

function itemFromRemoval(identity, sources) {
  const prior = sources.get(`${SOURCE_DIR}/${identity}.md`);
  if (!prior) refuse("Cannot remove an absent rule.");
  return { rule: prior, prior, deleting: true };
}

function planChanges(project, options) {
  const sources = loadSources(project);
  const items = collectItems(options, sources);
  const plan = { writes: new Map(), conflicts: [], legacy: new Set() };
  const force = "--force" in options;
  const finalSources = planRuleFiles(plan, project, items, sources, force);
  if (items.some((item) => isIndexed(item.rule))) planAgentsIndex(plan, project, finalSources);
  return plan;
}

function planRuleFiles(plan, project, items, sources, force) {
  const finalSources = new Map(sources);
  for (const { rule, prior, deleting } of items) {
    if (deleting) finalSources.delete(sourcePath(rule));
    else finalSources.set(sourcePath(rule), rule);
    planSource(plan, project, rule, deleting);
    for (const tool of copyTools(rule.targets)) {
      const wanted = deleting ? null : renderNative(rule, tool);
      const previous = prior && renderNative(prior, tool);
      planCopy(plan, project, force, nativePath(rule, tool), wanted, previous);
    }
  }
  return finalSources;
}

function planSource(plan, project, rule, deleting) {
  const relativePath = sourcePath(rule);
  const current = project.read(relativePath);
  const wanted = deleting ? null : renderSource(rule);
  if (current !== wanted) plan.writes.set(relativePath, wanted);
  if (current !== null && current.startsWith("<!-- aidd_rule:")) plan.legacy.add(relativePath);
}

// A copy is replaced when absent, legacy-signed or what we last wrote; anything else is a conflict.
function planCopy(plan, project, force, relativePath, wanted, previous) {
  const current = project.read(relativePath);
  if (current === wanted) return;
  const signed = current !== null && isLegacySigned(current, relativePath);
  if (signed && wanted !== null) plan.legacy.add(relativePath);
  if (current === null || signed || current === previous) {
    plan.writes.set(relativePath, wanted);
    return;
  }
  plan.conflicts.push(relativePath);
  if (force) plan.writes.set(relativePath, wanted);
}

function planAgentsIndex(plan, project, finalSources) {
  const current = project.read("AGENTS.md") ?? "";
  const next = reindexAgents(current, agentsIndexLines(finalSources));
  if (!next) refuse("AGENTS.md has an aidd_rules block the writer cannot trust; repair or remove it by hand.");
  if (next.legacy) plan.legacy.add("AGENTS.md");
  if (next.text !== current) plan.writes.set("AGENTS.md", next.text || null);
}

// ---------- effects: preflight, apply ----------

function operationOf(file, text) {
  if (text === null) return "delete";
  return fs.existsSync(file) ? "update" : "create";
}

function toOperations(project, writes) {
  return [...writes].map(([relativePath, text]) => {
    const file = project.resolve(relativePath);
    return { path: relativePath, file, operation: operationOf(file, text), text };
  });
}

function nearestExisting(file) {
  let candidate = file;
  while (!fs.existsSync(candidate)) candidate = path.dirname(candidate);
  return candidate;
}

// Every write lands through a rename in its parent, so only the parent directory must be writable.
function assertWritableDirectory(directory) {
  if (!fs.statSync(directory).isDirectory()) throw Object.assign(new Error(`${directory} is not a directory`), { code: "ENOTDIR" });
  fs.accessSync(directory, fs.constants.W_OK);
}

function parentToCheck(operation) {
  const parent = path.dirname(operation.file);
  return operation.operation === "delete" ? parent : nearestExisting(parent);
}

function describeFailure(operation, error) {
  return { path: operation.path, operation: operation.operation, code: error.code ?? error.name, message: error.message };
}

function findBlocked(operations) {
  const blocked = [];
  for (const operation of operations) {
    try {
      assertWritableDirectory(parentToCheck(operation));
    } catch (error) {
      blocked.push(describeFailure(operation, error));
    }
  }
  return blocked;
}

function performOperation(operation) {
  if (operation.operation === "delete") {
    fs.rmSync(operation.file, { force: true });
    return;
  }
  fs.mkdirSync(path.dirname(operation.file), { recursive: true });
  writeAtomically(operation.file, operation.text);
}

// A crash leaves the old file or the new one, never a truncated one.
function writeAtomically(file, text) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, text);
  try {
    fs.renameSync(temporary, file);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

function applyOperations(operations) {
  const written = [];
  for (const [index, operation] of operations.entries()) {
    try {
      performOperation(operation);
    } catch (error) {
      return { written, failed: describeFailure(operation, error), pending: operations.slice(index + 1).map((pending) => pending.path) };
    }
    written.push(operation.path);
  }
  return { written };
}

function publish(project, plan, summary) {
  const operations = toOperations(project, plan.writes);
  const blocked = findBlocked(operations);
  if (blocked.length) return { payload: { blocked, written: [] }, exitCode: EXIT.FILESYSTEM, message: `${blocked.length} path(s) not writable; nothing written.` };
  const outcome = applyOperations(operations);
  if (outcome.failed) return { payload: outcome, exitCode: EXIT.FILESYSTEM, message: `${outcome.failed.operation} failed on ${outcome.failed.path}: ${outcome.failed.message}` };
  return { payload: summary, exitCode: EXIT.OK };
}

// ---------- output ----------

function errorResult(error) {
  if (error instanceof UsageError) return { payload: { error: { code: "USAGE", message: error.message } }, exitCode: EXIT.USAGE, message: `${error.message}\nUsage: see header of write-rule.cjs` };
  const code = error instanceof Refusal ? "REFUSED" : error.code ?? error.name;
  return { payload: { error: { code, message: error.message } }, exitCode: EXIT.REFUSED, message: error.message };
}

function report({ payload, exitCode, message }) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  if (message) process.stderr.write(`${message}\n`);
  process.exitCode = exitCode;
}

function execute(argv) {
  const options = parseArgs(argv);
  const project = openProject(options["--project"]);
  const plan = planChanges(project, options);
  const files = toOperations(project, plan.writes).map(({ path: relativePath, operation }) => ({ path: relativePath, operation }));
  const summary = { files, conflicts: plan.conflicts, legacy: [...plan.legacy] };
  if (options["--plan"]) return { payload: { plan: true, ...summary }, exitCode: EXIT.OK };
  if (options["--check"]) {
    const drift = [...new Set([...plan.writes.keys(), ...plan.conflicts])];
    return { payload: { drift }, exitCode: drift.length ? EXIT.REFUSED : EXIT.OK };
  }
  if (plan.conflicts.length && !("--force" in options)) return { payload: { ...summary, files: [] }, exitCode: EXIT.REFUSED };
  return publish(project, plan, summary);
}

function main() {
  try {
    report(execute(process.argv.slice(2)));
  } catch (error) {
    report(errorResult(error));
  }
}

main();
