"use strict";
// No `@import` of a context file sits inside an HTML block, where a context loader skips it. Anchor: README.md.
// A block opens on any line starting with `<` and runs to the next blank line: stricter than CommonMark, because not every context loader is a CommonMark parser.
const fs = require("node:fs");
const path = require("node:path");

// Anywhere in the tree, not just the root: a monorepo package carries its own.
const CONTEXT_FILENAMES = ["CLAUDE.md", "AGENTS.md", "copilot-instructions.md"];
const SKIPPED_DIRS = new Set([".git", "node_modules", "worktrees", ".specstory", ".aidd"]);
// Snapshots of older framework versions, kept on the old shape as test input.
const EXCLUDED_PATHS = ["cli/tests/fixtures"];

const IMPORT_LINE = /^\s{0,3}@\S+/u;
const HTML_BLOCK_OPEN = /^\s{0,3}</u;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/u;

const isExcluded = (rel) => EXCLUDED_PATHS.some((dir) => rel === dir || rel.startsWith(`${dir}/`));

function collectContextFiles(root, dir = root, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name) || isExcluded(path.relative(root, full).split(path.sep).join("/"))) continue;
      collectContextFiles(root, full, found);
    } else if (CONTEXT_FILENAMES.includes(entry.name)) found.push(full);
  }
  return found;
}

/** Code blocks are skipped: the broken shape is quoted in documentation. */
function findHiddenImports(content) {
  const hidden = [];
  let fence = null;
  let openedAt = null;
  content.split("\n").forEach((line, index) => {
    const opener = FENCE.exec(line);
    if (fence) {
      // A fence closes only on the same character, repeated at least as often.
      if (opener && opener[1][0] === fence[0] && opener[1].length >= fence.length) fence = null;
      return;
    }
    if (opener) {
      fence = opener[1];
      return;
    }
    if (line.trim() === "") {
      openedAt = null;
      return;
    }
    if (openedAt === null && HTML_BLOCK_OPEN.test(line)) {
      openedAt = { line: index + 1, text: line.trim() };
      return;
    }
    if (openedAt !== null && IMPORT_LINE.test(line)) hidden.push({ line: index + 1, import: line.trim(), openedBy: openedAt });
  });
  return hidden;
}

module.exports = (ctx) =>
  collectContextFiles(ctx.root).flatMap((file) =>
    findHiddenImports(fs.readFileSync(file, "utf8")).map((h) => ({
      file: path.relative(ctx.root, file).split(path.sep).join("/"),
      line: h.line,
      offending: h.import,
      fix: `import inside the HTML block opened line ${h.openedBy.line} by ${h.openedBy.text}, add a blank line after the opening line or move the imports out`,
    })),
  );
module.exports.findHiddenImports = findHiddenImports;
module.exports.collectContextFiles = collectContextFiles;
