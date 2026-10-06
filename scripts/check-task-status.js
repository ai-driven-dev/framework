#!/usr/bin/env node
/**
 * Fails when a task document declares a `status` the kanban board cannot place.
 *
 * The board (kanban/) renders the banks' documents as five columns and sends any
 * unmapped status to `unknown` — a column the list and interactive views hide by
 * default. An off-vocabulary value is therefore silent drift: the document looks
 * tracked and no view shows it. This repository already paid for that with
 * `delivered`, `planned` and `framed` living invisibly next to the real columns.
 *
 * The vocabulary is the plan lifecycle
 * (plugins/aidd-dev/skills/01-plan/references/plan-status.md), the creation statuses
 * the aidd-pm templates stamp, and `done` as phases reach it. The board's own
 * mapping (kanban/src/domain/models/progress-status.ts) places every one of them;
 * the test suite pins that alignment.
 *
 * Always whole-bank — the hook's glob decides only whether this runs, never what it
 * reads — because a wrong status usually lands in a commit nothing else gates.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

/** The task banks the board reads. Memory pages carry no status and pass untouched. */
const BANKS = ["aidd_docs", "cli/aidd_docs", "kanban/aidd_docs"];

const ALLOWED_STATUSES = [
  // creation — plan creation and the aidd-pm templates
  "pending",
  "proposed",
  "open",
  "reported",
  // lifecycle — written by the implement and review steps
  "in-progress",
  "done",
  "implemented",
  "reviewed",
  "blocked",
];

/**
 * The `status` declared in the leading frontmatter block, with its line; body prose never
 * counts. Reads what the board's parser (gray-matter) would read: CRLF endings, quoted
 * values and inline comments resolve to the same value, so the gate and the board never
 * disagree about a document. A document declaring no status is out of scope on purpose:
 * absence stays visible as the board's `unknown` fallback, and whether `tasks/` documents
 * must declare one is a separate decision this gate does not preempt.
 */
function declaredStatus(content) {
  const lines = content.split(/\r?\n/u);
  if (lines[0] !== "---") return undefined;

  for (const [index, line] of lines.slice(1).entries()) {
    if (line === "---") return undefined;
    const match = line.match(/^status:\s*(.*?)\s*$/u);
    if (match) return { value: yamlScalar(match[1]), line: index + 2 };
  }

  return undefined;
}

/** The value YAML hands the board: inline comment dropped, surrounding quotes removed. */
function yamlScalar(raw) {
  let value = raw;

  const commentStart = value.search(/\s#/u);
  if (commentStart !== -1) value = value.slice(0, commentStart).trimEnd();

  const quoted = value.match(/^"(.*)"$/u) ?? value.match(/^'(.*)'$/u);
  return quoted ? quoted[1] : value;
}

function offVocabularyStatuses(content) {
  const declared = declaredStatus(content);
  if (declared === undefined || ALLOWED_STATUSES.includes(declared.value)) return [];
  return [declared];
}

function markdownFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...markdownFiles(entryPath));
    } else if (entry.name.endsWith(".md")) {
      files.push(entryPath);
    }
  }
  return files;
}

function main() {
  const violations = [];

  for (const bank of BANKS) {
    const bankPath = path.join(ROOT, bank);
    if (!fs.existsSync(bankPath)) continue;

    for (const filePath of markdownFiles(bankPath)) {
      for (const finding of offVocabularyStatuses(fs.readFileSync(filePath, "utf-8"))) {
        violations.push(
          `${path.relative(ROOT, filePath)}:${finding.line} status "${finding.value}"`
        );
      }
    }
  }

  if (violations.length > 0) {
    console.error("❌ status outside the board vocabulary (lands in the hidden `unknown` column):");
    for (const violation of violations) {
      console.error(`  ${violation}`);
    }
    console.error(`Allowed: ${ALLOWED_STATUSES.join(", ")}`);
    process.exit(1);
  }
}

module.exports = { ALLOWED_STATUSES, BANKS, declaredStatus, markdownFiles, offVocabularyStatuses };

if (require.main === module) {
  main();
}
