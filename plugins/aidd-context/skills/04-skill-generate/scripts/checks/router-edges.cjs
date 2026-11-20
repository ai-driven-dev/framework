"use strict";
// Each edge between two actions is a link in the source action or a transversal rule naming the target; a node with several exits labels all but the default.
const { flowOf, lineOf, edges, actionBoxes } = require("./mermaid.cjs");

const LINK = /\[[^\]\n]*\]\(([^)\s#]+)(?:#[^)]*)?\)/gu;

module.exports = function routerEdges(ctx) {
  const flow = flowOf(ctx.text);
  if (flow === undefined) return [];
  const hits = [];
  const at = (needle) => lineOf(ctx.text, needle);
  const actions = actionBoxes(flow);
  const rules = ctx.text.split("## Transversal rules")[1] ?? "";
  const unlabeled = new Map();
  for (const [from, to, arrow, line] of edges(flow)) {
    for (const [start, end] of arrow.startsWith("<") ? [[from, to], [to, from]] : [[from, to]]) {
      if (arrow.includes("|")) continue;
      const seen = unlabeled.get(start);
      unlabeled.set(start, { line: seen?.line ?? line, targets: new Set([...(seen?.targets ?? []), end]) });
    }
    const source = actions.get(from);
    const target = actions.get(to);
    if (!source || !target || source === target) continue;
    const name = target.split("/").pop();
    if (new RegExp(`\\b${name.replace(/^\d\d-|\.md$/gu, "")}\\b`, "iu").test(rules)) continue;
    const text = ctx.files.includes(source) ? ctx.view(source).text : "";
    if (![...text.matchAll(LINK)].some((m) => m[1].split("/").pop() === name)) {
      hits.push({ line: at(line), offending: `${from} --> ${to}`, fix: `link ${name} from the step of ${source} that takes this edge` });
    }
  }
  for (const [from, { line, targets }] of unlabeled) {
    if (targets.size > 1) hits.push({ line: at(line), offending: `${from} --> ${[...targets].join(", ")}`, fix: "label the condition of each edge but the default one" });
  }
  return hits;
};
