#!/usr/bin/env node
"use strict";

// Installed-skill entrypoint: deliberately independent of the framework and host packages.
const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");

const TOOLS = ["claude", "cursor", "copilot", "codex", "opencode"];
const CATEGORIES = ["architecture", "standards", "programming-languages", "frameworks-and-libraries", "tooling", "testing", "design-patterns", "quality", "domain", "other"];
const SHARED = ["codex", "opencode"];
const SOURCE = "aidd_docs/rules";
const fail = (message) => { throw new Error(message); };
const hash = (text) => createHash("sha256").update(text).digest("hex");
const contributionHash = (payload, separator) => hash(`separator=${separator}\n${payload}`);

function readUtf8(file) {
  const bytes = fs.readFileSync(file);
  const text = bytes.toString("utf8");
  if (!Buffer.from(text).equals(bytes)) fail(`Invalid UTF-8 in ${file}; refusing byte loss.`);
  return text;
}

function options(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!["--project", "--tools", "--input", "--delete", "--publish"].includes(key) || key in result) fail(`Unknown or repeated option: ${key}`);
    result[key] = key === "--publish" ? true : args[++i];
    if (!result[key] || (typeof result[key] === "string" && result[key].startsWith("--"))) fail(`Missing value: ${key}`);
  }
  if (!result["--project"] || !result["--tools"]) fail("Explicit --project and --tools are required.");
  if (["--input", "--delete", "--publish"].filter((key) => key in result).length !== 1) fail("Choose exactly one of --input, --delete or --publish.");
  return result;
}

function tools(value) {
  const selected = typeof value === "string" ? value.split(",") : value;
  if (!Array.isArray(selected) || !selected.length || new Set(selected).size !== selected.length || selected.some((tool) => !TOOLS.includes(tool))) fail("Targets must be distinct confirmed tools: claude,cursor,copilot,codex,opencode.");
  return [...selected].sort();
}

function identity(category, slug) {
  const index = CATEGORIES.findIndex((name, i) => category === `${String(i).padStart(2, "0")}-${name}`);
  if (index < 0 || typeof slug !== "string" || !new RegExp(`^${index}-[a-z0-9]+(?:[-@.][a-z0-9]+)*$`).test(slug)) fail("Invalid taxonomy category or matching #-slug.");
  return `${category}/${slug}`;
}

// Scan actual rendered text, never YAML-stripped approximations. Fenced examples remain text.
function scan(text) {
  if (text.includes("\0")) fail("NUL is not supported in rule text.");
  const active = [];
  let fence = null;
  let offset = 0;
  for (const line of text.match(/[^\n]*\n|[^\n]+$/g) || []) {
    const value = line.replace(/\r?\n$/, "");
    const match = /^(?: {0,3})(`{3,}|~{3,})(.*)$/.exec(value);
    if (fence) {
      if (match && match[1][0] === fence.char && match[1].length >= fence.length && !match[2].trim()) fence = null;
    } else if (match) {
      if (match[1][0] === "`" && match[2].includes("`")) fail("Invalid Markdown fence.");
      fence = { char: match[1][0], length: match[1].length };
    } else active.push({ value, offset, end: offset + line.length });
    offset += line.length;
  }
  if (fence) fail("Unclosed Markdown fence; close it before publishing rules.");
  return active;
}

function safeText(text) {
  if (Buffer.from(text).toString("utf8") !== text) fail("Unpaired Unicode surrogate; UTF-8 text must roundtrip.");
  if (scan(text).some(({ value }) => /<!--\s*aidd_(?:rules|rule:|rule_output|opencode_rules)/.test(value))) fail("Reserved AIDD rule marker outside a fenced example.");
}

function metadata(value, body, targets, fromSource = false) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Rule input must be a JSON object.");
  const keys = fromSource ? ["version", "category", "slug", "description", "paths", "targets"] : ["category", "slug", "description", "paths", "body"];
  if (Object.keys(value).some((key) => !keys.includes(key))) fail("Unknown rule metadata field.");
  identity(value.category, value.slug);
  if (fromSource && value.version !== 1) fail("Unsupported canonical metadata version.");
  if (typeof value.description !== "string" || !value.description.trim() || /[\r\n\0]/.test(value.description)) fail("Description must be a nonempty single line.");
  const paths = value.paths === undefined ? [] : value.paths;
  if (!Array.isArray(paths) || paths.some((glob) => typeof glob !== "string" || !glob.trim() || glob !== glob.trim() || /[,\r\n\0]/.test(glob)) || new Set(paths).size !== paths.length) fail("Paths must be distinct nonempty globs without commas or line breaks.");
  if (typeof body !== "string" || !body.trim()) fail("Body must be complete nonempty Markdown.");
  if (/^---\r?\n/.test(body)) fail("Body must not start with YAML frontmatter; supply scope in JSON metadata.");
  safeText(body);
  safeText(value.description + "\n" + paths.join("\n"));
  return { version: 1, category: value.category, slug: value.slug, description: value.description, paths, targets: tools(targets), body };
}

function canonical(rule) {
  const { body, ...meta } = rule;
  return `<!-- aidd_rule:${JSON.stringify(meta)} -->\n${body}`;
}

function parseCanonical(text, relative) {
  const match = /^<!-- aidd_rule:([^\r\n]+) -->\n/.exec(text);
  if (!match) fail(`Missing strict canonical metadata: ${relative}. Legacy sources are not migrated.`);
  let meta;
  try { meta = JSON.parse(match[1]); } catch { fail(`Invalid canonical JSON metadata: ${relative}`); }
  const rule = metadata(meta, text.slice(match[0].length), meta.targets, true);
  if (`${SOURCE}/${identity(rule.category, rule.slug)}.md` !== relative || canonical(rule) !== text) fail(`Noncanonical metadata or path: ${relative}`);
  return rule;
}

function nativePath(rule, tool) {
  const id = identity(rule.category, rule.slug);
  if (tool === "claude") return `.claude/rules/${id}.md`;
  if (tool === "cursor") return `.cursor/rules/${id}.mdc`;
  return `.github/instructions/${rule.category.slice(0, 2)}-${rule.slug.slice(2)}.instructions.md`;
}

function renderNative(rule, tool, signed = true) {
  const quote = JSON.stringify;
  let fields;
  if (tool === "claude") fields = rule.paths.length ? `paths:\n${rule.paths.map((glob) => `  - ${quote(glob)}\n`).join("")}` : "";
  if (tool === "cursor") fields = `description: ${quote(rule.description)}\n${rule.paths.length ? `globs: ${quote(rule.paths.join(","))}\n` : ""}alwaysApply: ${!rule.paths.length}\n`;
  if (tool === "copilot") fields = `applyTo: ${quote(rule.paths.length ? rule.paths.join(",") : "**")}\n`;
  const text = (fields ? `---\n${fields}---\n` : "") + rule.body;
  safeText(text);
  return signed ? `${text}\n<!-- aidd_rule_output:path=${nativePath(rule, tool)} sha256=${hash(text)} -->\n` : text;
}

function ownedNative(existing, prior, tool, relative) {
  const match = /\n<!-- aidd_rule_output:path=([^\s]+) sha256=([a-f0-9]{64}) -->\n$/.exec(existing);
  if (match && match[1] === relative && hash(existing.slice(0, match.index)) === match[2]) return;
  if (prior && existing === renderNative(prior, tool, false)) return;
  fail(`Edited or unowned native output: ${relative}. Restore the generated file; edit the canonical source instead.`);
}

function contribution(text) {
  const markers = scan(text).filter(({ value }) => /<!--\s*aidd_(?:rules|opencode_rules)/.test(value));
  if (!markers.length) return null;
  if (markers.length !== 2) fail("Duplicate, incomplete or legacy AIDD rule contribution; restore it explicitly. No automatic migration.");
  const start = /^<!-- aidd_rules:start sha256=([a-f0-9]{64}) separator=([01]) -->$/.exec(markers[0].value);
  if (!start || markers[1].value !== "<!-- aidd_rules:end -->") fail("Ambiguous or legacy AIDD rule contribution; no automatic migration.");
  const payload = text.slice(markers[0].end, markers[1].offset);
  if (contributionHash(payload, start[2]) !== start[1]) fail("Edited AIDD rule contribution; restore it and edit canonical sources instead.");
  const begin = markers[0].offset - Number(start[2]);
  if (begin < 0 || (start[2] === "1" && text[begin] !== "\n")) fail("Invalid contribution separator.");
  return { begin, end: markers[1].end };
}

function renderShared(existing, rules) {
  const old = contribution(existing);
  const selected = rules.filter((rule) => rule.targets.some((tool) => SHARED.includes(tool)));
  const payload = selected.map((rule) => {
    const scope = rule.paths.length ? `Apply this rule when working on files matching: ${rule.paths.map((glob) => JSON.stringify(glob)).join(", ")}.\n` : "Apply this rule to all files.\n";
    const text = `## ${identity(rule.category, rule.slug)}: ${rule.description}\n\n${scope}\n${rule.body}`;
    safeText(text);
    return text.endsWith("\n") ? text : text + "\n";
  }).join("\n");
  let result;
  if (!payload) result = old ? existing.slice(0, old.begin) + existing.slice(old.end) : existing;
  else {
    const prefix = old ? existing.slice(0, old.begin) : existing;
    const separator = prefix && !prefix.endsWith("\n") ? "\n" : "";
    const block = `${separator}<!-- aidd_rules:start sha256=${contributionHash(payload, separator.length)} separator=${separator.length} -->\n${payload}<!-- aidd_rules:end -->\n`;
    result = prefix + block + (old ? existing.slice(old.end) : "");
  }
  contribution(result);
  return result;
}

function main() {
  const opts = options(process.argv.slice(2));
  const selected = tools(opts["--tools"]);
  const root = path.resolve(opts["--project"]);
  if (!fs.statSync(root).isDirectory() || fs.realpathSync(root) !== root) fail("Project must be a real directory without symlink ancestors.");
  function target(relative) {
    if (path.isAbsolute(relative) || relative.split("/").some((part) => !part || part === "." || part === "..") || relative.includes("\\")) fail(`Unsafe project path: ${relative}`);
    let current = root;
    for (const part of relative.split("/")) {
      current = path.join(current, part);
      try { if (fs.lstatSync(current).isSymbolicLink()) fail(`Symlink target or ancestor: ${relative}`); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    return current;
  }
  function read(relative) {
    const file = target(relative);
    try { return readUtf8(file); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
  }
  const previous = new Map();
  function walk(relative) {
    const dir = target(relative);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (error) { if (error.code === "ENOENT") return; throw error; }
    for (const entry of entries) {
      const name = `${relative}/${entry.name}`;
      target(name);
      if (entry.isDirectory()) walk(name);
      else if (entry.isFile() && entry.name.endsWith(".md")) previous.set(name, parseCanonical(read(name), name));
      else fail(`Unexpected canonical source: ${name}`);
    }
  }
  walk(SOURCE);
  const prospective = new Map(previous);
  let changed;
  if (opts["--input"]) {
    const input = JSON.parse(readUtf8(path.resolve(opts["--input"])));
    const rule = metadata(input, input.body, selected);
    changed = `${SOURCE}/${identity(rule.category, rule.slug)}.md`;
    prospective.set(changed, rule);
  } else if (opts["--delete"]) {
    const parts = opts["--delete"].split("/");
    if (parts.length !== 2) fail("Delete requires <category>/<slug>.");
    changed = `${SOURCE}/${identity(...parts)}.md`;
    if (!previous.has(changed)) fail("Cannot delete an absent canonical rule.");
    prospective.delete(changed);
  }
  const nextRules = [...prospective.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, rule]) => rule);
  const affected = new Set(selected);
  if (changed && previous.has(changed)) for (const tool of previous.get(changed).targets) affected.add(tool);
  const writes = new Map();
  if (changed) writes.set(changed, prospective.has(changed) ? canonical(prospective.get(changed)) : null);
  for (const tool of affected) {
    if (SHARED.includes(tool)) continue;
    for (const name of new Set([...previous.keys(), ...prospective.keys()])) {
      const old = previous.get(name);
      const next = prospective.get(name);
      if (!old?.targets.includes(tool) && !next?.targets.includes(tool)) continue;
      const relative = nativePath(next || old, tool);
      const existing = read(relative);
      if (existing !== null) ownedNative(existing, old, tool, relative);
      writes.set(relative, next?.targets.includes(tool) ? renderNative(next, tool) : null);
    }
  }
  if ([...affected].some((tool) => SHARED.includes(tool))) {
    const existing = read("AGENTS.md");
    const updated = renderShared(existing || "", nextRules);
    if (selected.includes("codex") || nextRules.some((rule) => rule.targets.includes("codex"))) {
      if (read("AGENTS.override.md") !== null) fail("Root AGENTS.override.md masks Codex AGENTS.md; resolve the override explicitly.");
      if (Buffer.byteLength(updated) > 32768) fail("Local AGENTS.md exceeds Codex's default 32 KiB combined instruction limit.");
    }
    if (existing !== null || updated) writes.set("AGENTS.md", updated);
  }
  // Preflight every destination and ownership above; no validation can first happen after mutation.
  for (const relative of writes.keys()) target(relative);
  for (const [relative, text] of writes) {
    const file = target(relative);
    if (text === read(relative)) continue;
    if (text === null) { fs.rmSync(file, { force: true }); continue; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try { fs.writeFileSync(temporary, text, { flag: "wx" }); fs.renameSync(temporary, file); }
    finally { fs.rmSync(temporary, { force: true }); }
  }
  process.stdout.write(JSON.stringify({ files: [...writes.keys()] }) + "\n");
}

try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
