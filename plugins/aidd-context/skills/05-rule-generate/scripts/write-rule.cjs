#!/usr/bin/env node
"use strict";
// Usage: node write-rule.cjs --project <abs dir> --tools <claude,cursor,copilot,antigravity,codex,opencode> (--input <request.json> | --delete <category>/<slug> | --publish) [--plan | --check] [--force]
// Publishes aidd_docs/rules sources as native copies. Exit 0 ok, 1 refusal/conflict/drift, 2 usage error.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const TOOLS = ["claude", "cursor", "copilot", "antigravity", "codex", "opencode"];
const CATEGORIES = ["architecture", "standards", "programming-languages", "frameworks-and-libraries", "tooling", "testing", "design-patterns", "quality", "domain", "other"].map((n, i) => `0${i}-${n}`);
const SOURCE_DIR = "aidd_docs/rules";
const OPENCODE_INSTRUCTIONS = "aidd_docs/rules/*/*.md";
const fail = (match) => { throw new Error(match); };
const usage = (match) => { throw Object.assign(new Error(`${match}\nUsage: see header of write-rule.cjs`), { usage: true }); };
const sha = (t) => createHash("sha256").update(t).digest("hex");
const isUtf8 = (s) => Buffer.from(s).toString("utf8") === s;
const toolList = (l) => {
  if (!Array.isArray(l) || l.some((t) => !TOOLS.includes(t))) fail(`Unknown tool; expected ${TOOLS.join(",")}.`);
  return TOOLS.filter((t) => l.includes(t));
};

function utf8file(file) {
  const bytes = fs.readFileSync(file);
  const text = bytes.toString("utf8");
  if (!Buffer.from(text).equals(bytes)) fail(`Invalid UTF-8 in ${file}.`);
  return text;
}

function parseArgs(argv) {
  const options = {};
  const values = ["--project", "--tools", "--input", "--delete"];
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const flag = ["--publish", "--plan", "--check", "--force"].includes(k);
    if (!(flag || values.includes(k)) || k in options) usage(`Bad option: ${k}`);
    options[k] = flag || argv[++i];
    if (!options[k] || (!flag && options[k].startsWith("--"))) usage(`Missing value: ${k}`);
  }
  if (!options["--project"] || !options["--tools"]) usage("--project and --tools are required.");
  if (["--input", "--delete", "--publish"].filter((k) => k in options).length !== 1) usage("Choose exactly one of --input, --delete, --publish.");
  if (options["--check"] && (!options["--publish"] || options["--plan"])) usage("--check applies to --publish only, without --plan.");
  return options;
}

function validate(rule) {
  const i = CATEGORIES.indexOf(rule.category);
  if (i < 0 || typeof rule.slug !== "string" || !/^\d-[a-z0-9]+(?:[-.@][a-z0-9]+)*$/.test(rule.slug) || rule.slug[0] !== String(i)) fail("Invalid category or slug.");
  if (typeof rule.description !== "string" || !rule.description.trim() || /[\r\n]/.test(rule.description)) fail("Description must be a non-empty single line.");
  if (typeof rule.body !== "string" || !rule.body.trim()) fail("Body must be non-empty.");
  if (!Array.isArray(rule.paths) || rule.paths.some((p) => typeof p !== "string" || !p || /[,\r\n]/.test(p))) fail("Paths must be non-empty strings without commas or newlines.");
  if (![rule.body, rule.description, ...rule.paths].every(isUtf8)) fail("Text must be valid UTF-8.");
  rule.targets = toolList(rule.targets);
  return rule;
}

const srcPath = (rule) => `${SOURCE_DIR}/${rule.category}/${rule.slug}.md`;
const srcText = (rule) => `---\ndescription: ${JSON.stringify(rule.description)}\n${rule.paths.length ? `paths:\n${rule.paths.map((p) => `  - ${JSON.stringify(p)}\n`).join("")}` : ""}targets: [${rule.targets.join(", ")}]\n---\n\n${rule.body}`;

function parseSource(text, rel) {
  let match;
  let rule;
  if ((match = /^<!-- aidd_rule:([^\r\n]+) -->\n/.exec(text))) rule = { ...JSON.parse(match[1]), body: text.slice(match[0].length), legacy: true };
  else if ((match = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/.exec(text))) {
    rule = { body: match[2], paths: [], targets: [] };
    for (const line of match[1].split("\n")) {
      let x;
      if ((x = /^description: (.*)$/.exec(line))) rule.description = JSON.parse(x[1]);
      else if ((x = /^  - (.*)$/.exec(line))) rule.paths.push(JSON.parse(x[1]));
      else if ((x = /^targets: \[(.*)\]$/.exec(line))) rule.targets = x[1] ? x[1].split(", ") : [];
      else if (line !== "paths:") fail(`Unparseable source line in ${rel}.`);
    }
    [rule.category, rule.slug] = rel.slice(SOURCE_DIR.length + 1, -3).split("/");
  } else fail(`Unrecognized source: ${rel}`);
  rule.paths ??= [];
  rule.targets ??= [];
  if (srcPath(validate(rule)) !== rel) fail(`Source path does not match its identity: ${rel}`);
  return rule;
}

function nativePath(rule, tool) {
  if (tool === "claude") return `.claude/rules/${rule.category}/${rule.slug}.md`;
  if (tool === "cursor") return `.cursor/rules/${rule.category}/${rule.slug}.mdc`;
  if (tool === "antigravity") return `.agents/rules/${rule.slug}.md`;
  return `.github/instructions/${rule.category.slice(0, 2)}-${rule.slug.slice(2)}.instructions.md`;
}

function render(rule, tool) {
  const scoped = rule.paths.length > 0;
  const globs = JSON.stringify(rule.paths.join(","));
  const fm = {
    claude: scoped ? `paths:\n${rule.paths.map((p) => `  - ${JSON.stringify(p)}\n`).join("")}` : "",
    cursor: `description: ${JSON.stringify(rule.description)}\n${scoped ? `globs: ${globs}\n` : ""}alwaysApply: ${!scoped}\n`,
    copilot: `applyTo: ${scoped ? globs : '"**"'}\n`,
    antigravity: `description: ${JSON.stringify(rule.description)}\n${scoped ? `trigger: glob\nglobs: ${globs}\n` : "trigger: always_on\n"}`,
  }[tool];
  const text = (fm ? `---\n${fm}---\n` : "") + rule.body;
  if (tool === "antigravity" && Buffer.byteLength(text) > 24000) fail("Antigravity rule exceeds 24000 bytes.");
  return text;
}

// Legacy copies ended with a sha256 trailer; only a valid one proves we wrote the file.
function legacySigned(text, rel) {
  const match = /\n<!-- aidd_rule_output:path=(\S+) sha256=([a-f0-9]{64}) -->\n$/.exec(text);
  return !!match && match[1] === rel && sha(text.slice(0, match.index)) === match[2];
}

// Returns the new AGENTS.md text, or null when the existing block cannot be trusted.
function reindex(text, lines) {
  const marks = [...text.matchAll(/^<!-- aidd_rules:(start|end)(.*?)-->$/gm)];
  const block = lines.length ? `<!-- aidd_rules:start -->\nBefore editing a file, read each rule whose scope matches it.\n\n${lines.join("\n")}\n<!-- aidd_rules:end -->\n` : "";
  if (!marks.length) return { text: block ? text + (text.endsWith("\n\n") ? "" : text.endsWith("\n") ? "\n" : text ? "\n\n" : "") + block : text };
  if (marks.length !== 2 || marks[0][1] !== "start" || marks[1][1] !== "end") return null;
  const s = marks[0].index;
  const e = marks[1].index + marks[1][0].length + (text[marks[1].index + marks[1][0].length] === "\n" ? 1 : 0);
  let begin = s;
  let old = false;
  if (marks[0][2] !== " ") {
    const match = /^ sha256=([a-f0-9]{64}) separator=([01]) $/.exec(marks[0][2]);
    if (!match || sha(`separator=${match[2]}\n${text.slice(s + marks[0][0].length + 1, marks[1].index)}`) !== match[1] || (match[2] === "1" && text[s - 1] !== "\n")) return null;
    begin = s - Number(match[2]);
    old = true;
  }
  if (block) return { text: text.slice(0, s) + block + text.slice(e), old };
  const prefix = text.slice(0, begin);
  return { text: (!old && prefix.endsWith("\n\n") ? prefix.slice(0, -1) : prefix) + text.slice(e), old };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const tools = toolList(options["--tools"].split(","));
  const root = path.resolve(options["--project"]);
  if (!path.isAbsolute(options["--project"]) || !fs.statSync(root).isDirectory() || fs.realpathSync(root) !== root) fail("Project must be a real absolute directory.");
  const target = (rel) => {
    const parts = rel.split("/");
    if (parts.some((p) => !p || p === "." || p === "..") || rel.includes("\\")) fail(`Unsafe path: ${rel}`);
    let current = root;
    for (const p of parts) {
      current = path.join(current, p);
      try { if (fs.lstatSync(current).isSymbolicLink()) fail(`Symlink in path: ${rel}`); } catch (e) { if (e.code !== "ENOENT") throw e; }
    }
    return current;
  };
  const read = (rel) => { try { return utf8file(target(rel)); } catch (e) { if (e.code === "ENOENT") return null; throw e; } };
  const list = (rel) => { try { return fs.readdirSync(target(rel)).sort(); } catch (e) { if (e.code === "ENOENT") return []; throw e; } };

  const sources = new Map();
  for (const cat of list(SOURCE_DIR)) for (const f of list(`${SOURCE_DIR}/${cat}`)) if (f.endsWith(".md")) sources.set(`${SOURCE_DIR}/${cat}/${f}`, parseSource(read(`${SOURCE_DIR}/${cat}/${f}`), `${SOURCE_DIR}/${cat}/${f}`));

  const union = (rule) => toolList([...rule.targets, ...tools]);
  const items = []; // { rule, prior, del }
  if (options["--input"]) {
    const req = JSON.parse(utf8file(path.resolve(options["--input"])));
    if (!req || typeof req !== "object" || Object.keys(req).some((k) => !["category", "slug", "description", "body", "paths"].includes(k))) fail("Request must be an object with category, slug, description, body, paths.");
    const rule = validate({ paths: [], ...req, targets: tools });
    const prior = sources.get(srcPath(rule));
    rule.targets = union({ targets: prior ? prior.targets : [] });
    items.push({ rule, prior });
  } else if (options["--delete"]) {
    const prior = sources.get(`${SOURCE_DIR}/${options["--delete"]}.md`);
    if (!prior) fail("Cannot delete an absent rule.");
    items.push({ rule: { ...prior, targets: union(prior) }, prior, del: true });
  } else for (const prior of sources.values()) items.push({ rule: { ...prior, targets: union(prior) }, prior });

  const writes = new Map();
  const conflicts = [];
  const legacy = new Set();
  const force = !!options["--force"];
  const copy = (rel, want, ours) => {
    const current = read(rel);
    if (current === want) return;
    const signed = current !== null && legacySigned(current, rel);
    if (signed && want !== null) legacy.add(rel);
    if (current === null || signed || current === ours) return void writes.set(rel, want);
    conflicts.push(rel);
    if (force) writes.set(rel, want);
  };
  const final = new Map(sources);
  for (const { rule, prior, del } of items) {
    const rel = srcPath(rule);
    if (del) final.delete(rel); else final.set(rel, rule);
    const current = read(rel);
    const want = del ? null : srcText(rule);
    if (current !== want) writes.set(rel, want);
    if (current !== null && current.startsWith("<!-- aidd_rule:")) legacy.add(rel);
    for (const tool of rule.targets.filter((t) => !["codex", "opencode"].includes(t))) copy(nativePath(rule, tool), del ? null : render(rule, tool), prior && render(prior, tool));
  }
  if (items.some((i) => i.rule.targets.includes("codex"))) {
    const lines = [...final].sort(([a], [b]) => (a < b ? -1 : 1)).filter(([, rule]) => rule.targets.includes("codex")).map(([rel, rule]) => {
      const scope = rule.paths.length ? rule.paths.map((p) => `\`${p}\``).join(", ") : "all files";
      return `- ${scope}: [${/^# (.+)$/m.exec(rule.body)?.[1].trim() || rule.slug}](${rel})`;
    });
    const current = read("AGENTS.md");
    const next = reindex(current ?? "", lines);
    if (!next) conflicts.push("AGENTS.md");
    else {
      if (next.old) legacy.add("AGENTS.md");
      if (next.text !== (current ?? "")) writes.set("AGENTS.md", next.text || null);
    }
  }
  const unsupported = [];
  if (items.some((i) => i.rule.targets.includes("opencode"))) {
    const found = ["opencode.json", "opencode.jsonc"].filter((n) => read(n) !== null);
    if (!found.some((n) => read(n).includes(OPENCODE_INSTRUCTIONS))) unsupported.push({ tool: "opencode", missing: OPENCODE_INSTRUCTIONS, file: found[0] || "opencode.json" });
  }

  const files = [...writes.keys()];
  const out = (x, code = 0) => { process.stdout.write(`${JSON.stringify(x)}\n`); process.exitCode = code; };
  const result = { files, conflicts, unsupported, legacy: [...legacy] };
  if (options["--plan"]) return out({ plan: true, ...result });
  if (options["--check"]) {
    const drift = [...new Set([...files, ...conflicts])];
    return out({ drift }, drift.length ? 1 : 0);
  }
  if (conflicts.length && !force) return out({ ...result, files: [] }, 1);
  for (const [rel, text] of writes) {
    const file = target(rel);
    if (text === null) { fs.rmSync(file, { force: true }); continue; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
  out(result);
}

try { main(); } catch (e) { process.stderr.write(`${e.message}\n`); process.exitCode = e.usage ? 2 : 1; }
