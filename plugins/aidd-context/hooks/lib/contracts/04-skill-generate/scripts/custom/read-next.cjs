"use strict";
// An action the diagram chains to another ends its Process with a step that links the next action.
const { flowOf, edges, actionBoxes } = require("./mermaid.cjs");
const { headings } = require("../../../lib/markdown.cjs");

const ACTION_LINK = /\]\((?:\.\/)?(\d\d-[^)/]+\.md)\)/u;

module.exports = function readNext(ctx) {
  const flow = flowOf(ctx.view("SKILL.md").text) ?? "";
  const actions = actionBoxes(flow);
  const chained = edges(flow).some(([from, to]) => actions.get(from) === ctx.file && actions.has(to) && from !== to);
  if (!chained) return [];
  const sections = headings(ctx.prose).filter((h) => h.level === 2);
  const process = sections.find((s) => s.name === "Process");
  if (!process) return [];
  const end = sections.find((s) => s.line > process.line)?.line ?? ctx.lines.length + 1;
  let step;
  for (let i = process.line; i < end - 1; i += 1) if (/^\d+\.\s/u.test(ctx.lines[i])) step = i;
  return step !== undefined && !ACTION_LINK.test(ctx.lines[step]) ? [{ line: step + 1, offending: ctx.lines[step] }] : [];
};
