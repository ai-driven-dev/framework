/**
 * The filesystem layer the two rules need: `architecture-rules.js` stays pure, and everything
 * that reads a directory or a file lives here, so the rules can be decided without the engine
 * ever learning what a directory is.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { checkArchitecture, classifyFile } = require("./architecture-rules.js");

const CITATION_SHAPES =
  "a cell under a table header that reads Action, a fenced `actions/<name>.md` path, or a " +
  "backticked `<name>.md` file name — a word in prose does not count";

/** Rule two needs the skill's action files; the engine never reads them itself. */
function actionFileNames(relativePath, absolutePath) {
  if (path.basename(relativePath) !== "SKILL.md") return undefined;
  try {
    return fs
      .readdirSync(path.join(path.dirname(absolutePath), "actions"))
      .filter((name) => name.endsWith(".md"));
  } catch {
    return [];
  }
}

function violationsForFile(relativePath, content, absolutePath) {
  try {
    const found = checkArchitecture(relativePath, content, actionFileNames(relativePath, absolutePath));
    return Array.isArray(found) ? found : [];
  } catch {
    return [];
  }
}

function describeFix({ rule, plugin }) {
  return rule === "orthogonality"
    ? `name the concept ${plugin} owns instead of addressing it directly`
    : `cite every action file the skill provides in its "## Actions" section. A citation is ${CITATION_SHAPES}`;
}

function markdownUnder(directory, root, found) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) markdownUnder(full, root, found);
    else if (entry.name.endsWith(".md")) {
      found.push(path.relative(root, full).split(path.sep).join("/"));
    }
  }
  return found;
}

/** Every governed path in the tree, for the whole-tree run CI does. */
function governedPaths(root) {
  const plugins = path.join(root, "plugins");
  if (!fs.existsSync(plugins)) return [];
  return markdownUnder(plugins, root, []).filter((relativePath) => classifyFile(relativePath));
}

/** Violations across paths already on disk. A path that is not governed contributes none. */
function scan(root, relativePaths) {
  const violations = [];
  for (const relativePath of relativePaths) {
    if (!classifyFile(relativePath)) continue;
    const absolutePath = path.join(root, relativePath);
    let content;
    try {
      content = fs.readFileSync(absolutePath, "utf8");
    } catch {
      continue;
    }
    violations.push(...violationsForFile(relativePath, content, absolutePath));
  }
  return violations;
}

module.exports = {
  describeFix,
  governedPaths,
  scan,
};
