"use strict";
// A bundled skill, agent or agent template sets no `model` or `effort` in its front matter: the host picks both. Anchor: marketplace.json.
const fs = require("node:fs");
const path = require("node:path");
const { frontmatter, readText } = require("../../engine/markdown.cjs");
const { trackedFiles } = require("./no-local-paths.cjs");

const BUNDLED = /^plugins\/.*(?:\/SKILL\.md|\/agents\/[^/]+\.md|\/assets\/agent-template\.md)$/u;

module.exports = (ctx) => {
  const root = path.resolve(path.dirname(ctx.abs), "..");
  const found = [];
  for (const file of trackedFiles(root).filter((f) => BUNDLED.test(f))) {
    const abs = path.join(root, file);
    if (!fs.existsSync(abs)) continue;
    const fm = frontmatter(readText(abs));
    for (const key of ["model", "effort"]) {
      if (key in fm.fields) found.push({ file: path.relative(ctx.root, abs), line: fm.fieldLine[key], offending: `${key}: ${fm.fields[key]}`, fix: `remove ${key} from the front matter, the host picks it` });
    }
  }
  return found;
};
