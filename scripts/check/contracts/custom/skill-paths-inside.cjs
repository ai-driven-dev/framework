"use strict";
// No path a skill's prose names in backticks climbs out of that skill. Anchor: marketplace.json.
// A skill installs both flat and as a marketplace, under tool folders that differ, so only a path inside the skill holds in every copy.
// Markdown links are SKILL-21's. Resolved from the file that names the path, as a relative link is.
// Only a word starting with `../` is read: one wrapped in punctuation, starting with `./../`, or written from the repository root or `${CLAUDE_PLUGIN_ROOT}` is not.
const fs = require("node:fs");
const path = require("node:path");
const { trackedFiles } = require("./no-local-paths.cjs");

const SKILL_FILE = /^plugins\/[^/]+\/skills\/[^/]+\/.+\.md$/u;
const BACKTICKED = /`([^`\n]+)`/gu;

module.exports = (ctx) => {
  const root = path.resolve(path.dirname(ctx.abs), "..");
  const found = [];
  for (const file of trackedFiles(root).filter((f) => SKILL_FILE.test(f))) {
    let text;
    try {
      text = fs.readFileSync(path.join(root, file), "utf8");
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "EISDIR") continue;
      throw error;
    }
    const skill = file.split("/").slice(0, 4).join("/");
    for (const [index, line] of text.split("\n").entries()) {
      for (const match of line.matchAll(BACKTICKED)) {
        for (const word of match[1].split(/\s+/u).filter((w) => w.startsWith("../"))) {
          const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), word));
          if (target === skill || target.startsWith(skill + "/")) continue;
          found.push({ file: path.relative(ctx.root, path.join(root, file)), line: index + 1, fix: `name a path inside the skill, ${word} leaves it` });
        }
      }
    }
  }
  return found;
};
