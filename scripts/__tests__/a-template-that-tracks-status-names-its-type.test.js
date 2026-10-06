const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");

// A template that stamps `status:` feeds the kanban board, and the board's type badge and
// --type filter read `type:` from the same frontmatter. aidd-dev shipped three templates
// without it and every plan and phase landed as `type: unknown` - 49 of 49 parents on this
// repository's own board. This ratchet keeps the next status-bearing template from
// repeating that silently.

/** The leading frontmatter block's lines, CRLF tolerated; undefined without one. */
function frontmatterLines(content) {
  const lines = content.split(/\r?\n/u);
  if (lines[0] !== "---") return undefined;

  const closing = lines.indexOf("---", 1);
  if (closing === -1) return undefined;

  return lines.slice(1, closing);
}

function templateFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...templateFiles(entryPath));
    } else if (entry.name.endsWith(".md")) {
      files.push(entryPath);
    }
  }
  return files;
}

function assetDirectories() {
  const directories = [];
  const pluginsPath = path.join(root, "plugins");

  for (const plugin of fs.readdirSync(pluginsPath)) {
    const skillsPath = path.join(pluginsPath, plugin, "skills");
    if (!fs.existsSync(skillsPath)) continue;

    for (const skill of fs.readdirSync(skillsPath)) {
      const assetsPath = path.join(skillsPath, skill, "assets");
      if (fs.existsSync(assetsPath)) directories.push(assetsPath);
    }
  }

  return directories;
}

test("every plugin template that stamps a status also names its type", () => {
  const untyped = [];
  let statusBearing = 0;

  for (const assetsPath of assetDirectories()) {
    for (const filePath of templateFiles(assetsPath)) {
      const lines = frontmatterLines(fs.readFileSync(filePath, "utf-8"));
      if (lines === undefined || !lines.some((line) => /^status:/u.test(line))) continue;

      statusBearing += 1;
      if (!lines.some((line) => /^type:/u.test(line))) {
        untyped.push(path.relative(root, filePath));
      }
    }
  }

  assert.ok(statusBearing > 0, "no status-bearing template found; the walk is broken");
  assert.deepEqual(untyped, []);
});
