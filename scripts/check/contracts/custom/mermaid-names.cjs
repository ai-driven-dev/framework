"use strict";
// A Mermaid class is never named like a node or a subgraph of its diagram. Anchor: README.md.
// Such a collision makes the whole diagram fail to parse, and every diagram after it on the page: GitHub shows raw text, with no error in the repository.
const fs = require("node:fs");
const path = require("node:path");
const { linkChecker, DEFAULT_IGNORES } = require("./markdown-links.cjs");

const diagrams = (text) => [...text.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((match) => ({ body: match[1], line: text.slice(0, match.index).split("\n").length }));

/** Class names a diagram also uses as a node or a subgraph. */
function collisions(diagram) {
  const classes = new Set([...diagram.matchAll(/classDef\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]));
  const names = new Set([
    ...[...diagram.matchAll(/subgraph\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]),
    ...[...diagram.matchAll(/(?:^|[\s>&"|])([A-Za-z][A-Za-z0-9_]*)(?=[[({])/gm)].map((m) => m[1]),
  ]);
  return [...classes].filter((name) => names.has(name));
}

module.exports = (ctx) =>
  linkChecker(ctx.root)
    .collectMarkdownFiles(["."], DEFAULT_IGNORES)
    .flatMap((file) => {
      const rel = path.relative(ctx.root, file).split(path.sep).join("/");
      return diagrams(fs.readFileSync(file, "utf8")).flatMap(({ body, line }) =>
        collisions(body).map((name) => ({ file: rel, line, offending: name, fix: `the class "${name}" is also a node or a subgraph, rename the class` })),
      );
    });
module.exports.collisions = collisions;
module.exports.diagrams = diagrams;
