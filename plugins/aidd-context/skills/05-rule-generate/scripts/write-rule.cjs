#!/usr/bin/env node
"use strict";
// Usage: node write-rule.cjs --project <abs dir> --tools <claude,cursor,copilot,antigravity,codex,opencode> (--input <request.json> | --delete <category>/<slug> | --publish) [--plan | --check] [--force] [--opencode-entry]
// Publishes aidd_docs/rules sources as native copies.
// --opencode-entry (needs opencode in --tools; not with --check) adds "aidd_docs/rules/*/*.md" to opencode.json instructions; without it a missing entry is only reported as unsupported.
// Exit 0 ok, 1 refusal/conflict/drift/unexpected error, 2 usage error, 3 filesystem blocked or failed.
// Every non-zero exit prints a JSON object on stdout.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");

const TOOLS = ["claude", "cursor", "copilot", "antigravity", "codex", "opencode"];
const CATEGORIES = ["architecture", "standards", "programming-languages", "frameworks-and-libraries", "tooling", "testing", "design-patterns", "quality", "domain", "other"].map((name, index) => `0${index}-${name}`);
const SOURCE_DIR = "aidd_docs/rules";
const OPENCODE_INSTRUCTIONS = "aidd_docs/rules/*/*.md";
const OPENCODE_CONFIG = "opencode.json";
const OPENCODE_SCHEMA = "https://opencode.ai/config.json";
const FLAG_OPTIONS = ["--publish", "--plan", "--check", "--force", "--opencode-entry"];
const VALUE_OPTIONS = ["--project", "--tools", "--input", "--delete"];
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

function mergeTargets(targets, tools) {
  return parseTools([...targets, ...tools]);
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
  if (!options["--project"] || !options["--tools"]) rejectUsage("--project and --tools are required.");
  const actions = ["--input", "--delete", "--publish"].filter((name) => name in options);
  if (actions.length !== 1) rejectUsage("Choose exactly one of --input, --delete, --publish.");
  if (options["--check"] && (!options["--publish"] || options["--plan"])) rejectUsage("--check applies to --publish only, without --plan.");
  if (options["--opencode-entry"] && options["--check"]) rejectUsage("--opencode-entry cannot be combined with --check.");
  if (options["--opencode-entry"] && !options["--tools"].split(",").includes("opencode")) rejectUsage("--opencode-entry requires opencode in --tools.");
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
    cursor: `description: ${quote(rule.description)}\n${scoped ? `globs: ${globs}\n` : ""}alwaysApply: ${!scoped}\n`,
    copilot: `applyTo: ${scoped ? globs : '"**"'}\n`,
    antigravity: `description: ${quote(rule.description)}\n${scoped ? `trigger: glob\nglobs: ${globs}\n` : "trigger: always_on\n"}`,
  }[tool];
  const text = (frontmatter ? `---\n${frontmatter}---\n` : "") + rule.body;
  if (tool === "antigravity" && Buffer.byteLength(text) > ANTIGRAVITY_MAX_BYTES) refuse(`Antigravity rule exceeds ${ANTIGRAVITY_MAX_BYTES} bytes.`);
  return text;
}

const copyTools = (targets) => targets.filter((tool) => tool !== "codex" && tool !== "opencode");

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
    .filter(([, rule]) => rule.targets.includes("codex"))
    .map(([relativePath, rule]) => {
      const scope = rule.paths.length ? rule.paths.map((glob) => `\`${glob}\``).join(", ") : "all files";
      const title = /^# (.+)$/m.exec(rule.body)?.[1].trim() || rule.slug;
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

function collectItems(project, options, tools, sources) {
  if (options["--input"]) return [itemFromRequest(options["--input"], tools, sources)];
  if (options["--delete"]) return [itemFromDeletion(options["--delete"], tools, sources)];
  return [...sources.values()].map((prior) => ({ rule: { ...prior, targets: mergeTargets(prior.targets, tools) }, prior }));
}

function itemFromRequest(inputFile, tools, sources) {
  const request = parseRequest(readUtf8(path.resolve(inputFile)));
  const rule = validateRule({ paths: [], ...request, targets: tools });
  const prior = sources.get(sourcePath(rule));
  return { rule: { ...rule, targets: mergeTargets(prior ? prior.targets : [], tools) }, prior };
}

function itemFromDeletion(identity, tools, sources) {
  const prior = sources.get(`${SOURCE_DIR}/${identity}.md`);
  if (!prior) refuse("Cannot delete an absent rule.");
  return { rule: { ...prior, targets: mergeTargets(prior.targets, tools) }, prior, deleting: true };
}

function planChanges(project, options, tools) {
  const sources = loadSources(project);
  const items = collectItems(project, options, tools, sources);
  const plan = { writes: new Map(), conflicts: [], legacy: new Set(), unsupported: [] };
  const force = "--force" in options;
  const finalSources = planRuleFiles(plan, project, items, sources, force);
  if (items.some((item) => item.rule.targets.includes("codex"))) planAgentsIndex(plan, project, finalSources);
  if (items.some((item) => item.rule.targets.includes("opencode"))) {
    if (options["--opencode-entry"]) planOpencodeEntry(plan, project);
    else planOpencodeCheck(plan, project);
  }
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
  if (!next) {
    plan.conflicts.push("AGENTS.md");
    return;
  }
  if (next.legacy) plan.legacy.add("AGENTS.md");
  if (next.text !== current) plan.writes.set("AGENTS.md", next.text || null);
}

function planOpencodeCheck(plan, project) {
  const configs = [OPENCODE_CONFIG, "opencode.jsonc"].filter((name) => project.read(name) !== null);
  if (configs.some((name) => project.read(name).includes(OPENCODE_INSTRUCTIONS))) return;
  plan.unsupported.push({ tool: "opencode", missing: OPENCODE_INSTRUCTIONS, file: configs[0] || OPENCODE_CONFIG });
}

function planOpencodeEntry(plan, project) {
  const current = project.read(OPENCODE_CONFIG);
  if (current === null && project.read("opencode.jsonc") !== null) refuse(`opencode.jsonc is not supported; ${addByHand()}`);
  const next = current === null ? renderOpencodeConfig() : withInstructionsEntry(current);
  if (next !== current) plan.writes.set(OPENCODE_CONFIG, next);
}

// ---------- opencode.json text edit: pure, keeps every other byte ----------

const addByHand = () => `add ${quote(OPENCODE_INSTRUCTIONS)} to its instructions by hand.`;

function renderOpencodeConfig() {
  return `${JSON.stringify({ $schema: OPENCODE_SCHEMA, instructions: [OPENCODE_INSTRUCTIONS] })}\n`;
}

function parseOpencodeConfig(text) {
  let config;
  try {
    config = JSON.parse(text);
  } catch {
    refuse(`${OPENCODE_CONFIG} is not valid JSON; ${addByHand()}`);
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) refuse(`${OPENCODE_CONFIG} must be a JSON object; ${addByHand()}`);
  if ("instructions" in config && !Array.isArray(config.instructions)) refuse(`${OPENCODE_CONFIG} "instructions" must be an array; ${addByHand()}`);
  return config;
}

function skipWhitespace(text, index) {
  while (/\s/.test(text[index])) index++;
  return index;
}

function endOfString(text, start) {
  let index = start + 1;
  while (text[index] !== '"') index += text[index] === "\\" ? 2 : 1;
  return index + 1;
}

function endOfValue(text, start) {
  if (text[start] === '"') return endOfString(text, start);
  if (text[start] === "{" || text[start] === "[") return readContainer(text, start).closeIndex + 1;
  return start + /^[^\s,\]}]+/.exec(text.slice(start))[0].length;
}

// Locates the members of a valid JSON object or array: where each begins, where its value starts and ends.
function readContainer(text, openIndex) {
  const closer = text[openIndex] === "{" ? "}" : "]";
  const items = [];
  let index = skipWhitespace(text, openIndex + 1);
  while (text[index] !== closer) {
    const item = { begin: index };
    if (closer === "}") {
      const keyEnd = endOfString(text, index);
      item.key = JSON.parse(text.slice(index, keyEnd));
      item.keyEnd = keyEnd;
      index = skipWhitespace(text, skipWhitespace(text, keyEnd) + 1);
    }
    item.valueStart = index;
    item.end = endOfValue(text, index);
    items.push(item);
    index = skipWhitespace(text, item.end);
    if (text[index] === ",") index = skipWhitespace(text, index + 1);
  }
  return { items, closeIndex: index };
}

function separatorBetweenItems(text, openIndex, items) {
  if (items.length > 1) return text.slice(items[0].end, items[1].begin);
  const leading = text.slice(openIndex + 1, items[0].begin);
  return leading.includes("\n") ? `,\n${leading.slice(leading.lastIndexOf("\n") + 1)}` : `,${leading}`;
}

function appendItem(text, openIndex, items, rendered) {
  if (!items.length) return text.slice(0, openIndex + 1) + rendered + text.slice(openIndex + 1);
  const last = items[items.length - 1];
  return text.slice(0, last.end) + separatorBetweenItems(text, openIndex, items) + rendered + text.slice(last.end);
}

function addInstructionsMember(text, rootIndex, members) {
  const colon = members.length ? text.slice(members[0].keyEnd, members[0].valueStart) : ":";
  return appendItem(text, rootIndex, members, `"instructions"${colon}[${quote(OPENCODE_INSTRUCTIONS)}]`);
}

function appendToInstructions(text, member) {
  const { items } = readContainer(text, member.valueStart);
  return appendItem(text, member.valueStart, items, quote(OPENCODE_INSTRUCTIONS));
}

function withInstructionsEntry(text) {
  const config = parseOpencodeConfig(text);
  if (config.instructions?.includes(OPENCODE_INSTRUCTIONS)) return text;
  const rootIndex = skipWhitespace(text, 0);
  const members = readContainer(text, rootIndex).items;
  const instructions = members.filter((member) => member.key === "instructions").pop();
  const edited = instructions ? appendToInstructions(text, instructions) : addInstructionsMember(text, rootIndex, members);
  const expected = { ...config, instructions: [...(config.instructions ?? []), OPENCODE_INSTRUCTIONS] };
  if (!isDeepStrictEqual(JSON.parse(edited), expected)) refuse(`Editing ${OPENCODE_CONFIG} would change more than the entry; ${addByHand()}`);
  return edited;
}

// ---------- effects: preflight, apply ----------

function toOperations(project, writes) {
  return [...writes].map(([relativePath, text]) => ({
    path: relativePath,
    file: project.resolve(relativePath),
    operation: text === null ? "delete" : "write",
    text,
  }));
}

function nearestExisting(file) {
  let candidate = file;
  while (!fs.existsSync(candidate)) candidate = path.dirname(candidate);
  return candidate;
}

function writabilityProbe(operation) {
  return operation.operation === "delete" ? path.dirname(operation.file) : nearestExisting(operation.file);
}

function describeFailure(operation, error) {
  return { path: operation.path, operation: operation.operation, code: error.code ?? error.name, message: error.message };
}

function findBlocked(operations) {
  const blocked = [];
  for (const operation of operations) {
    try {
      fs.accessSync(writabilityProbe(operation), fs.constants.W_OK);
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
  fs.writeFileSync(operation.file, operation.text);
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
  const tools = parseTools(options["--tools"].split(","));
  const project = openProject(options["--project"]);
  const plan = planChanges(project, options, tools);
  const files = [...plan.writes.keys()];
  const summary = { files, conflicts: plan.conflicts, unsupported: plan.unsupported, legacy: [...plan.legacy] };
  if (options["--plan"]) return { payload: { plan: true, ...summary }, exitCode: EXIT.OK };
  if (options["--check"]) {
    const drift = [...new Set([...files, ...plan.conflicts])];
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
