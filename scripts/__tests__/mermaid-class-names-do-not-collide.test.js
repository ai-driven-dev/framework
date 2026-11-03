const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");
const { REPO_ROOT: ROOT } = require("../lib/repository-path.cjs");

/**
 * A Mermaid class named like a node or a subgraph makes the whole diagram fail to parse, and
 * every diagram after it on the page. GitHub shows raw text instead of a picture, with no error
 * in the repository. This reads each diagram the documents carry and refuses that collision.
 */

const DOCUMENTS = [
  "README.md",
  "CONTRIBUTING.md",
  "GOVERNANCE.md",
  "RELEASE.md",
  "docs/ARCHITECTURE.md",
  "docs/GUIDES.md",
  "docs/MAINTAINERS.md",
  "cli/ARCHITECTURE.md",
];

function diagrams(file) {
  const text = fs.readFileSync(path.join(ROOT, file), "utf8");
  return [...text.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((match) => match[1]);
}

describe("the Mermaid diagrams in the documents", () => {
  for (const file of DOCUMENTS) {
    it(`${file} names no class like a node or a subgraph`, () => {
      for (const diagram of diagrams(file)) {
        const classes = new Set([...diagram.matchAll(/classDef\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]));
        const names = new Set([
          ...[...diagram.matchAll(/subgraph\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]),
          ...[...diagram.matchAll(/(?:^|[\s>&"|])([A-Za-z][A-Za-z0-9_]*)(?=[[({])/gm)].map((m) => m[1]),
        ]);
        for (const name of classes) assert.ok(!names.has(name), `${file}: the class "${name}" is also a node or a subgraph`);
      }
    });
  }
});
