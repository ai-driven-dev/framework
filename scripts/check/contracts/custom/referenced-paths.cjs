"use strict";
// A path the prose names in backticks, anchored on a real top-level entry, exists. Anchor: README.md.
// Whole tree, never the staged files: a path dies when the file it names is deleted, in a commit that touches no page.
// A reference is anchored on a real top-level entry rather than on "looks like a path": widening it to any `a/b` token reports MIME types and shell fragments.
const fs = require("node:fs");
const path = require("node:path");

/** Prose this repository owns and can keep true, besides its root markdown. */
const SCANNED = ["docs", "aidd_docs/memory"];

/**
 * Paths the prose names as something the reader creates, never as its own content.
 * `.aidd/config.json` is the telemetry opt-in switch a repository commits to turn measurement on; this one has not.
 * `.agents/hooks.json` is the hooks file an Antigravity install writes into the reader's project.
 */
const READER_CREATED = new Set([".aidd/config.json", ".agents/hooks.json"]);

const BACKTICKED = /`([^`\n]+)`/gu;

/** Read from disk: a new directory joins the check by existing, a deleted one stops being an anchor. */
const topLevelEntries = (root) => new Set(fs.readdirSync(root).filter((entry) => entry !== ".git"));

function referencedPaths(content, entries) {
  const found = [];
  for (const [index, line] of content.split("\n").entries()) {
    for (const match of line.matchAll(BACKTICKED)) {
      const token = match[1].trim();
      // A command, a placeholder, a version range or a glob is not a path to resolve.
      if (/[\s<>*$|…]/u.test(token)) continue;
      if (token.startsWith(">") || token.startsWith("=")) continue;
      // Files only: a bare directory is usually a shape rather than a location.
      if (!path.extname(token)) continue;
      if (READER_CREATED.has(token)) continue;
      if (!entries.has(token.split("/")[0])) continue;
      found.push({ target: token, line: index + 1 });
    }
  }
  return found;
}

function markdownUnder(root, dir) {
  const absolute = path.resolve(root, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs
    .readdirSync(absolute, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
}

function scannedFiles(root) {
  const rootMarkdown = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(root, entry.name));
  return [...rootMarkdown, ...SCANNED.flatMap((dir) => markdownUnder(root, dir))];
}

function deadReferences(root, files = scannedFiles(root)) {
  const entries = topLevelEntries(root);
  return files.flatMap((file) =>
    referencedPaths(fs.readFileSync(file, "utf8"), entries)
      .filter(({ target }) => !fs.existsSync(path.resolve(root, target)))
      .map(({ line, target }) => ({ file, line, target })),
  );
}

module.exports = (ctx) =>
  deadReferences(ctx.root).map(({ file, line, target }) => ({ file: path.relative(ctx.root, file).split(path.sep).join("/"), line, offending: target, fix: `${target} names nothing on disk` }));
module.exports.referencedPaths = referencedPaths;
module.exports.topLevelEntries = topLevelEntries;
module.exports.scannedFiles = scannedFiles;
module.exports.deadReferences = deadReferences;
