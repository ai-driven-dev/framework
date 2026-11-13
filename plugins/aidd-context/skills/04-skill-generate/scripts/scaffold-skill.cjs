#!/usr/bin/env node
"use strict";
// Usage: node scaffold-skill.cjs <plan.json> <skill-folder>
// Fills the structural slots of ../assets/skill-template.md and ../assets/action-template.md
// from a plan, and leaves every content slot to the model. Creates only missing files.
// Plan: {"name", "description", "entries"?: [{"to": <slug>, "label"?}], "actions": [{"slug", "title",
// "next": [{"to": <slug> or "end": <outcome>, "label"?}]}]}. Without entries, the request enters the first action. Exit 0 written, 1 refused plan or template, 2 usage.

const fs = require("node:fs");
const path = require("node:path");

const ASSETS = path.join(__dirname, "../assets");
const USAGE = "usage: scaffold-skill.cjs <plan.json> <skill-folder>\n";
const SKILL_SLOTS = ["<skill-name>", "<description>", "<Skill Name>", "<diagram from the plan>"];
const ACTION_SLOTS = ["<NN>", "<title>", "<read-next step>"];

function template(name, slots) {
  const text = fs.readFileSync(path.join(ASSETS, name), "utf8");
  const missing = slots.filter((slot) => !text.includes(slot));
  if (missing.length > 0) throw new Error(`${name} lacks the slot ${missing.join(", ")}`);
  return text;
}

/** Every reason the plan cannot be drawn as R5 asks, one per line. */
function refusals(plan) {
  const slugs = new Set((plan.actions ?? []).map((action) => action.slug));
  const found = [];
  if (!plan.name || !plan.description) found.push("give the plan a name and a description");
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
  return `Read ${[...labeled, ...fallback].join("; ")}.`;
}

function render(plan, skillText, actionText) {
  const files = new Map(plan.actions.map((action, index) => [action.slug, `${number(index)}-${action.slug}.md`]));
  const title = plan.name.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
  const router = skillText
    .replace("<skill-name>", plan.name)
    .replace("<description>", plan.description)
    .replace("<Skill Name>", title)
    .replace("<diagram from the plan>", diagram(plan, files));
  const out = new Map([["SKILL.md", router]]);
  plan.actions.forEach((action, index) => {
    const next = readNext(action, files);
    const text = actionText
      .replace("<NN>", number(index))
      .replace("<title>", action.title)
      .replace(/^(\d+\. )<read-next step>\n/mu, next ? `$1${next}\n` : "");
    out.set(`actions/${files.get(action.slug)}`, text);
  });
  return out;
}

function main(args) {
  if (args.length !== 2) {
    process.stderr.write(USAGE);
    return 2;
  }
  const [planFile, skill] = args;
  let plan;
  let skillText;
  let actionText;
  try {
    plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
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
    if (fs.existsSync(full)) {
      process.stdout.write(`kept ${full}\n`);
      continue;
    }
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
    process.stdout.write(`created ${full}\n`);
  }
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
