// One read of a project's design system, shared by every check.
const fs = require("node:fs");
const path = require("node:path");
const { parseRecord } = require("./markdown.cjs");

const UI_DIR = "aidd_docs/ui";
const TOKENS_FILE = "tokens.json";
const SHOWCASE_DIR = "showcase";
const RECORD_EXTENSION = ".md";
const RENDER_EXTENSION = ".html";
const ROOT_FOLDER = "";

/** A path relative to the project root, with forward slashes on every platform. */
const relative = (root, file) => path.relative(root, file).split(path.sep).join("/");

/** Every file under `dir`, sorted, skipping the generated showcase. */
function walk(dir, top = dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return dir === top && entry.name === SHOWCASE_DIR ? [] : walk(full, top);
      return [full];
    });
}

/** A record with its file, folder under `aidd_docs/ui/`, name, front matter and sections. */
function readRecord(root, uiDir, full) {
  const folder = path.relative(uiDir, path.dirname(full)).split(path.sep).join("/");
  return {
    file: relative(root, full),
    folder: folder || ROOT_FOLDER,
    name: path.basename(full, RECORD_EXTENSION),
    ...parseRecord(fs.readFileSync(full, "utf8")),
  };
}

/** The design system under `root`, or null when the project has none. */
function load(root) {
  const uiDir = path.join(root, UI_DIR);
  if (!fs.existsSync(uiDir) || !fs.statSync(uiDir).isDirectory()) return null;
  const files = walk(uiDir);
  const tokensPath = path.join(uiDir, TOKENS_FILE);
  return {
    root,
    records: files.filter((file) => file.endsWith(RECORD_EXTENSION)).map((file) => readRecord(root, uiDir, file)),
    tokensFile: relative(root, tokensPath),
    tokens: fs.existsSync(tokensPath) ? fs.readFileSync(tokensPath, "utf8") : null,
    renders: files.filter((file) => file.endsWith(RENDER_EXTENSION)).map((file) => relative(root, file)),
  };
}

module.exports = { load, UI_DIR };
