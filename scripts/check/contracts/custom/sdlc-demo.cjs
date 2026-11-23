"use strict";
// Every /aidd-x:NN-name the README, the guides and the demo animation cite is a skill of this repository. Anchor: .claude-plugin/marketplace.json.
const fs = require("node:fs");
const path = require("node:path");

const CITED = ["README.md", "docs/GUIDES.md", "docs/CONCEPTS.md", "docs/INSTALL.md", "docs/FAQ.md", "docs/assets/sdlc-demo/scenes.json"];
const SKILL = /\/(aidd-[a-z]+):(\d+-[0-9a-z-]+)/gu;

module.exports = (ctx) => {
  const root = path.resolve(path.dirname(ctx.abs), "..");
  const found = [];
  for (const file of CITED) {
    for (const [index, line] of fs.readFileSync(path.join(root, file), "utf8").split("\n").entries()) {
      for (const [cited, plugin, name] of line.matchAll(SKILL)) {
        if (!fs.existsSync(path.join(root, "plugins", plugin, "skills", name, "SKILL.md"))) found.push({ file: path.relative(ctx.root, path.join(root, file)), line: index + 1, offending: cited, fix: `names ${cited}, which is not a skill of this repository` });
      }
    }
  }
  return found;
};
