#!/usr/bin/env node
"use strict";
// Usage: node scaffold-skill.cjs <plan.json|-> <skill-folder> (- reads JSON from stdin)
// Fills the structural slots of ../assets/skill-template.md and ../assets/action-template.md
// from a plan, and leaves every content slot to the model. Creates only missing files.
// Plan: {"name", "description", "entries"?: [{"to": <slug>, "label"?}], "actions": [{"slug", "title",
// "next": [{"to": <slug> or "end": <outcome>, "label"?}]}]}. Without entries, the request enters the first action. Exit 0 written, 1 refused plan or template, 2 usage.

const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");

const ASSETS = path.join(__dirname, "../assets");
const USAGE = "usage: scaffold-skill.cjs <plan.json|-> <skill-folder> (- reads JSON from stdin)\n"
  + "       scaffold-skill.cjs --native <options.json|-> <project> [--plan]\n";
const SKILL_SLOTS = ["{{skill-name}}", "{{description}}", "{{Skill Name}}", "{{diagram from the plan}}"];
const ACTION_SLOTS = ["{{NN}}", "{{title}}", "{{read-next step}}"];
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ROOTS = {
  claude: ".claude", cursor: ".cursor", opencode: ".opencode", copilot: ".github",
  codex: ".agents", kilo: ".kilo", antigravity: ".agents", kiro: ".kiro", kimi: ".agents",
};
const MANAGED_FIELDS = new Set(["name", "description"]);
const FIELD = /^(?:([A-Za-z0-9_.-]+)|"([A-Za-z0-9_.-]+)"|'([A-Za-z0-9_.-]+)'):(?:[ \t]|$)/u;
const OPTION = /^[a-z][a-zA-Z0-9_.-]*$/u;
const YAML_KEYWORD = /^(?:null|true|false|y|n|yes|no|on|off)$/iu;
const FRONTMATTER = /^(---\r?\n)([\s\S]*?)(^---(?:\r?\n|$))/mu;
const isObject = (item) => item !== null && typeof item === "object" && !Array.isArray(item);
const readInput = (file) => JSON.parse(fs.readFileSync(file === "-" ? 0 : file, "utf8"));

function hasOnlyFiniteNumbers(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (value === null || typeof value !== "object") return true;
  return Object.values(value).every(hasOnlyFiniteNumbers);
}

function nativeTargets(input) {
  if (!isObject(input) || typeof input.name !== "string" || !KEBAB.test(input.name)) throw new Error("name must be kebab-case");
  if (!Array.isArray(input.targets) || !input.targets.length) throw new Error("targets must list at least one host");
  const optionsByHost = input.nativeOptions === undefined ? {} : input.nativeOptions;
  if (!isObject(optionsByHost)) throw new Error("nativeOptions must be an object keyed by selected host");
  for (const [host, options] of Object.entries(optionsByHost)) {
    if (!input.targets.includes(host)) throw new Error(`${host}: native options require a selected host`);
    if (!isObject(options)) throw new Error(`${host}: native options must be an object`);
    for (const [key, value] of Object.entries(options)) {
      if (MANAGED_FIELDS.has(key)) throw new Error(`${host}: ${key} is a managed field`);
      if (!OPTION.test(key) || !hasOnlyFiniteNumbers(value)) throw new Error(`${host}: invalid native option ${key}`);
    }
  }
  const grouped = new Map();
  for (const host of new Set(input.targets)) {
    if (typeof host !== "string" || !Object.hasOwn(ROOTS, host)) throw new Error(`unknown skill target ${host}`);
    const relative = `${ROOTS[host]}/skills/${input.name}/SKILL.md`;
    const options = optionsByHost[host] ?? {};
    const existing = grouped.get(relative);
    if (!existing) grouped.set(relative, { path: relative, hosts: [host], options });
    else {
      if (!isDeepStrictEqual(existing.options, options)) {
        throw new Error(`${relative}: different native options for ${[...existing.hosts, host].join(", ")}`);
      }
      existing.hosts.push(host);
    }
  }
  return [...grouped.values()];
}

function readTarget(project, relative) {
  const fullPath = path.join(project, relative);
  let file = project;
  for (const part of relative.split("/")) {
    file = path.join(file, part);
    try {
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error(`symlink on the way to ${relative}`);
      if (file === fullPath && (!stat.isFile() || stat.nlink !== 1)) throw new Error(`expected one regular file at ${relative}`);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }
  return fs.readFileSync(file, "utf8");
}

const yamlField = (key, value) => `${YAML_KEYWORD.test(key) ? JSON.stringify(key) : key}: ${JSON.stringify(value)}`;

function editNativeFields(text, options, relative) {
  const match = FRONTMATTER.exec(text);
  if (!match || match.index !== 0) throw new Error(`${relative}: missing YAML frontmatter`);
  const [frontmatter, opening, body, closing] = match;
  const eol = opening.endsWith("\r\n") ? "\r\n" : "\n";
  const seen = new Set();
  const lines = [];
  let replacing = false;
  for (const line of body.slice(0, -eol.length).split(eol)) {
    const field = FIELD.exec(line);
    if (field) {
      const key = field[1] ?? field[2] ?? field[3];
      replacing = Object.hasOwn(options, key);
      if (replacing && seen.has(key)) throw new Error(`${relative}: duplicate frontmatter field ${key}`);
      if (replacing) {
        lines.push(yamlField(key, options[key]));
        seen.add(key);
      } else lines.push(line);
    } else if (/^\s*(?:#|$)/u.test(line)) lines.push(line);
    else if (/^(?:[ \t]|-(?:[ \t]|$))/u.test(line)) {
      if (!replacing) lines.push(line);
    } else throw new Error(`${relative}: native options require a block frontmatter mapping`);
  }
  for (const key of Object.keys(options).sort()) if (!seen.has(key)) lines.push(yamlField(key, options[key]));
  return opening + lines.join(eol) + eol + closing + text.slice(frontmatter.length);
}

function writeNative(file, project, preview) {
  if (!path.isAbsolute(project) || !fs.statSync(project).isDirectory()) throw new Error("project must be an absolute directory");
  const changes = nativeTargets(readInput(file)).map((target) => {
    const current = readTarget(project, target.path);
    if (!Object.keys(target.options).length) return { ...target, operation: "unchanged" };
    if (current === null) {
      if (!preview) throw new Error(`${target.path}: scaffold the skill before applying native options`);
      return { ...target, operation: "create" };
    }
    const content = editNativeFields(current, target.options, target.path);
    if (current === content) return { ...target, operation: "unchanged" };
    fs.accessSync(path.join(project, target.path), fs.constants.W_OK);
    return { ...target, operation: "update", content };
  });
  if (!preview) {
    for (const change of changes) {
      if (change.operation === "update") fs.writeFileSync(path.join(project, change.path), change.content);
    }
  }
  process.stdout.write(`${JSON.stringify({ changes: changes.map(({ path, hosts, operation, options }) => ({ path, hosts, operation, options })) })}\n`);
}

function template(name, slots) {
  const text = fs.readFileSync(path.join(ASSETS, name), "utf8").replace(/\r\n?/gu, "\n");
  const missing = slots.filter((slot) => !text.includes(slot));
  if (missing.length > 0) throw new Error(`${name} lacks the slot ${missing.join(", ")}`);
  return text;
}

/** Every reason the plan cannot be drawn as R5 asks, one per line. */
function refusals(plan) {
  const slugs = new Set((plan.actions ?? []).map((action) => action.slug));
  const found = [];
  if (!plan.name || !plan.description) found.push("give the plan a name and a description");
  for (const name of [plan.name, ...slugs]) if (name && !KEBAB.test(name)) found.push(`${name}: write it in kebab-case`);
  if (slugs.size === 0) found.push("give the plan at least one action");
  const entries = plan.entries ?? [];
  for (const edge of entries) if (!slugs.has(edge.to)) found.push(`entry: no action is named ${edge.to}`);
  if (entries.filter((edge) => !edge.label).length > 1) found.push("entry: label every entry but the default one");
  for (const action of plan.actions ?? []) {
    const next = action.next ?? [];
    if (next.length === 0) found.push(`${action.slug}: give it an outcome, a next action or an end`);
    for (const edge of next) if (edge.to !== undefined && !slugs.has(edge.to)) found.push(`${action.slug}: no action is named ${edge.to}`);
    if (next.filter((edge) => !edge.label).length > 1) found.push(`${action.slug}: label every edge but the default one`);
  }
  return found;
}

const number = (index) => String(index + 1).padStart(2, "0");
const arrow = (edge) => (edge.label ? `-->|"${edge.label}"|` : "-->");

function diagram(plan, files) {
  const boxes = plan.actions.map((action) => `  ${action.slug}["actions/${files.get(action.slug)}"]`);
  const edges = plan.actions.flatMap((action) =>
    action.next.map((edge) => `  ${action.slug} ${arrow(edge)} ${edge.to ?? `${edge.end}((${edge.end}))`}`),
  );
  const entries = (plan.entries ?? [{ to: plan.actions[0].slug }]).map((edge, index) => `  ${index === 0 ? "entry([request])" : "entry"} ${arrow(edge)} ${edge.to}`);
  return [...boxes, ...entries, ...edges].join("\n").trimStart();
}

/** The last step: a link per next action, the default one last, or nothing when the action only ends. */
function readNext(action, files) {
  const targets = action.next.filter((edge) => edge.to !== undefined && edge.to !== action.slug);
  if (targets.length === 0) return null;
  const link = (edge) => `[${edge.to}](${files.get(edge.to)})`;
  const labeled = targets.filter((edge) => edge.label).map((edge) => `${link(edge)} when ${edge.label}`);
  const fallback = targets.filter((edge) => !edge.label).map((edge) => (labeled.length > 0 ? `otherwise ${link(edge)}` : link(edge)));
  return `Read ${[...labeled, ...fallback].join(", ")}.`;
}

function render(plan, skillText, actionText) {
  const files = new Map(plan.actions.map((action, index) => [action.slug, `${number(index)}-${action.slug}.md`]));
  const title = plan.name.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
  const router = skillText
    .replace("{{skill-name}}", () => plan.name)
    .replace("{{description}}", () => plan.description)
    .replace("{{Skill Name}}", () => title)
    .replace("{{diagram from the plan}}", () => diagram(plan, files));
  const out = new Map([["SKILL.md", router]]);
  plan.actions.forEach((action, index) => {
    const next = readNext(action, files);
    const text = actionText
      .replace("{{NN}}", () => number(index))
      .replace("{{title}}", () => action.title)
      .replace(/^(\d+\. )\{\{read-next step\}\}\n/mu, (_, step) => (next ? `${step}${next}\n` : ""));
    out.set(`actions/${files.get(action.slug)}`, text);
  });
  return out;
}

/** Writes the file only when none exists, in one call so nothing can appear between the check and the write; false when it was kept. */
function createOnly(file, text) {
  try {
    fs.writeFileSync(file, text, { flag: "wx" });
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
}

function main(args) {
  if (args[0] === "--native" && (args.length === 3 || (args.length === 4 && args[3] === "--plan"))) {
    try {
      writeNative(args[1], args[2], args[3] === "--plan");
      return 0;
    } catch (error) {
      process.stderr.write(`scaffold-skill: ${error.message}\n`);
      return 1;
    }
  }
  if (args.length !== 2) {
    process.stderr.write(USAGE);
    return 2;
  }
  const [planFile, skill] = args;
  let plan;
  let skillText;
  let actionText;
  try {
    plan = readInput(planFile);
    skillText = template("skill-template.md", SKILL_SLOTS);
    actionText = template("action-template.md", ACTION_SLOTS);
  } catch (error) {
    process.stderr.write(`scaffold-skill: ${error.message}\n`);
    return 1;
  }
  const found = refusals(plan);
  if (found.length > 0) {
    process.stderr.write(`scaffold-skill: the plan cannot be drawn\n${found.join("\n")}\n`);
    return 1;
  }
  for (const [file, text] of render(plan, skillText, actionText)) {
    const full = path.join(skill, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    process.stdout.write(`${createOnly(full, text) ? "created" : "kept"} ${full}\n`);
  }
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
