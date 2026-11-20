"use strict";
// A context file's memory block carries the reference form its tool resolves: `@` imports for CLAUDE.md, markdown links for AGENTS.md and the copilot instructions. Anchor: README.md.
// The expected form is read from the memory hook's own TARGET_FILES, never restated: a second copy of that table could disagree with the one that writes.
const fs = require("node:fs");
const path = require("node:path");

const HOOK = path.join("plugins", "aidd-context", "hooks", "memory.cjs");
const BLOCK_OPEN = "<!-- aidd_project_memory:start -->";
const BLOCK_CLOSE = "<!-- aidd_project_memory:end -->";
const TARGET_ENTRY = /\{\s*path:\s*"([^"]+)"\s*,\s*syntax:\s*"(at|link)"\s*\}/gu;
const AT_REFERENCE = /^@(\S+)$/u;
const LINK_REFERENCE = /^\[[^\]]+\]\([^)]+\)$/u;

const declaredTargets = (hookSource) => [...hookSource.matchAll(TARGET_ENTRY)].map(([, file, syntax]) => ({ path: file, syntax }));

/** `null` when the line is not a reference at all: prose, an html comment and the read-on-demand list share the block. */
function referenceForm(line) {
  if (AT_REFERENCE.test(line)) return "at";
  if (LINK_REFERENCE.test(line)) return "link";
  return null;
}

/** A file with no block, and one whose markers are unpaired, yield nothing: the memory hook reports the unpaired case itself. */
function referenceFormProblems(content, expected) {
  const lines = content.split("\n");
  const opensAt = lines.findIndex((line) => line.includes(BLOCK_OPEN));
  if (opensAt === -1) return [];
  const closesAt = lines.findIndex((line, index) => index > opensAt && line.includes(BLOCK_CLOSE));
  if (closesAt === -1) return [];
  const problems = [];
  for (let index = opensAt + 1; index < closesAt; index += 1) {
    const found = referenceForm(lines[index].trim());
    if (found !== null && found !== expected) problems.push({ line: index + 1, reference: lines[index].trim(), found });
  }
  return problems;
}

module.exports = (ctx) => {
  const hook = path.join(ctx.root, HOOK);
  // A check that passes because it compared against nothing is worse than no check.
  const targets = fs.existsSync(hook) ? declaredTargets(fs.readFileSync(hook, "utf8")) : [];
  if (targets.length === 0) return [{ line: 1, fix: `no TARGET_FILES entry found in ${HOOK.split(path.sep).join("/")}, the check has nothing to compare against` }];
  return targets.flatMap((target) => {
    const file = path.join(ctx.root, target.path);
    if (!fs.existsSync(file)) return [];
    return referenceFormProblems(fs.readFileSync(file, "utf8"), target.syntax).map((p) => ({
      line: 1,
      offending: p.reference,
      fix: `${target.path}:${p.line}: declares "${target.syntax}", found "${p.found}", run the aidd-context memory refresh or fix the block by hand`,
    }));
  });
};
module.exports.declaredTargets = declaredTargets;
module.exports.referenceForm = referenceForm;
module.exports.referenceFormProblems = referenceFormProblems;
