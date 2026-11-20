"use strict";
// Reads a plan folder once: the plan status, and per listed phase its status, dependencies and task numbers.
const fs = require("node:fs");
const path = require("node:path");
const { readText, frontmatter, proseLines } = require("../lib/markdown.cjs");
const { shape, cells } = require("../lib/ops.cjs");

const TASK_HEADING = /^###\s*`?(\d+)\)/gmu;
const CLOSED = ["implemented", "blocked"];

function dependencies(cell) {
  const text = cell.replace(/`/gu, "");
  return text === "none" ? [] : text.split(/\s*,\s*/u).map(Number);
}

function readPhase(root, row) {
  const number = Number(row[0]);
  const file = `phase-${number}.md`;
  const full = path.join(root, file);
  const exists = fs.existsSync(full);
  const text = exists ? readText(full) : "";
  const status = exists ? frontmatter(text).fields.status : undefined;
  const tasks = [...text.matchAll(TASK_HEADING)].map((match) => `${number}.${match[1]}`);
  return { number, file, exists, status, tasks, dependencies: dependencies(row.at(-1)) };
}

function readState(root) {
  const text = readText(path.join(root, "plan.md"));
  const fm = frontmatter(text);
  const prose = proseLines(text).map((line, index) => (index < fm.span ? "" : line));
  const body = shape(text, prose, fm).sections.find((section) => section.name === "Phases")?.body ?? [];
  const rows = body.map(cells).filter((row) => /^\d+$/u.test(row[0] ?? "") && row.length >= 4);
  return { planStatus: fm.fields.status, phases: rows.map((row) => readPhase(root, row)) };
}

const listNumbers = (phases) => phases.map((phase) => phase.number).join(", ");

function readyPhases(phases) {
  const done = (number) => phases.find((phase) => phase.number === number)?.status === "done";
  return phases.filter((phase) => phase.status === "pending" && phase.dependencies.every(done));
}

/** The navigation line: what to do after a clean run. Not a validation. */
function nextStep({ planStatus, phases }) {
  if (CLOSED.includes(planStatus)) return undefined;
  const running = phases.filter((phase) => phase.status === "in-progress");
  const ready = readyPhases(phases);
  const start = planStatus === "pending" ? "mark the plan in-progress, then " : "";
  if (running.length) return `phase ${listNumbers(running)} is in progress: build its next task, or close it`;
  if (ready.length) return `${start}take phase ${ready[0].number}`;
  if (phases.every((phase) => phase.status === "done")) return "every phase is done: read actions/03-finalize.md";
  return "no phase is ready, stop and ask";
}

module.exports = { readState, nextStep, listNumbers };
