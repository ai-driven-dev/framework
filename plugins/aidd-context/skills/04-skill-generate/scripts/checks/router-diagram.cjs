"use strict";
// The router diagram is a flowchart LR whose boxes are exactly the action files, named by plain ids.
const { flowOf, lineOf, splitArrows, nodeIds, ACTION_NODE, BOX } = require("./mermaid.cjs");

module.exports = function routerDiagram(ctx) {
  const flow = flowOf(ctx.text);
  if (flow === undefined) return [{ line: 1, fix: "draw the actions as a flowchart LR diagram" }];
  const hits = [];
  const at = (needle) => lineOf(ctx.text, needle);
  if (!/^\s*flowchart LR\b/mu.test(flow)) hits.push({ line: at("```mermaid") + 1, offending: flow.split("\n")[0], fix: "start the diagram with flowchart LR" });
  const drawn = new Set([...flow.matchAll(ACTION_NODE)].map((m) => m[1]));
  const present = ctx.files.filter((f) => /^actions\/[^/]+\.md$/u.test(f));
  for (const action of present) if (!drawn.has(action)) hits.push({ line: at("```mermaid"), offending: action, fix: `draw a node labeled ${action}` });
  for (const action of drawn) if (!present.includes(action)) hits.push({ line: at(action), offending: action, fix: "remove the node or write its action file" });
  for (const [box, , label] of flow.matchAll(BOX)) {
    if (!/^actions\/[^"]+\.md$/u.test(label)) hits.push({ line: at(box), offending: box, fix: "draw only action files as boxes; cite a reference from the step that uses it" });
  }
  for (const raw of flow.split("\n")) {
    const line = raw.trim();
    for (const id of splitArrows(line).segments.flatMap(nodeIds)) {
      if (!/^[\w-]+$/u.test(id)) hits.push({ line: at(line), offending: id, fix: "name the node with a plain id; cite a file from the step that uses it" });
    }
  }
  return hits;
};
