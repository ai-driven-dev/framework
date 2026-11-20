"use strict";
// Mermaid flowchart reading for the router checks. Not a check itself.
const ACTION_NODE = /\["(actions\/[^"]+\.md)"\]/gu;
const BOX = /([\w-]+)\["([^"]*)"\]/gu;
const ARROWS = ["-->", "-.->", "==>"];

const flowOf = (text) => /```mermaid\n([\s\S]*?)```/u.exec(text)?.[1];
const lineOf = (text, needle) => text.split("\n").findIndex((line) => line.includes(needle)) + 1 || 1;

/** A diagram line split into node segments and the arrows between them, each arrow with its `<` and `|label|`. */
function splitArrows(line) {
  const segments = [];
  const arrows = [];
  let rest = line;
  for (;;) {
    const found = ARROWS.map((token) => ({ token, at: rest.indexOf(token) })).filter(({ at }) => at >= 0);
    if (found.length === 0) break;
    const { token, at } = found.reduce((first, next) => (next.at < first.at ? next : first));
    const start = rest[at - 1] === "<" ? at - 1 : at;
    let end = at + token.length;
    const close = rest[end] === "|" ? rest.indexOf("|", end + 1) : -1;
    if (close >= 0) end = close + 1;
    segments.push(rest.slice(0, start).trim());
    arrows.push(rest.slice(start, end));
    rest = rest.slice(end);
  }
  segments.push(rest.trim());
  return { segments, arrows };
}

const nodeIds = (segment) => segment.split("&").map((part) => /^\s*([^\s[({]+)/u.exec(part)?.[1]).filter(Boolean);

/** Each edge of the flow as [from, to, arrow, line]. */
function edges(flow) {
  const out = [];
  for (const raw of flow.split("\n")) {
    const line = raw.trim();
    const { segments, arrows } = splitArrows(line);
    for (let i = 0; i + 1 < segments.length; i += 1) {
      for (const from of nodeIds(segments[i])) for (const to of nodeIds(segments[i + 1])) out.push([from, to, arrows[i], line]);
    }
  }
  return out;
}

const actionBoxes = (flow) => new Map([...flow.matchAll(BOX)].filter(([, , label]) => /^actions\/[^"]+\.md$/u.test(label)).map(([, id, label]) => [id, label]));

module.exports = { flowOf, lineOf, splitArrows, nodeIds, edges, actionBoxes, ACTION_NODE, BOX };
