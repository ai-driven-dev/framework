// One read of a project's design system, shared by every check.
const fs = require("node:fs");
const path = require("node:path");
const { parseRecord } = require("./markdown.cjs");

const UI_DIR = "aidd_docs/ui";
const TOKENS_FILE = "tokens.json";
const SHOWCASE_DIR = "showcase";
const RECORD_EXTENSION = ".md";
const RENDER_EXTENSION = ".html";
const PATH_SEPARATOR = "/";
const UNREADABLE = "unreadable";

const TRAILING_SEPARATORS = /\/+$/;

/** A path relative to the project root, with forward slashes on every platform. */
const relative = (root, file) => path.relative(root, file).split(path.sep).join(PATH_SEPARATOR);

/** Whether `file` is `prefix` or lies under it, both relative to the project root. */
function isUnder(file, prefix) {
  const folder = prefix.replace(TRAILING_SEPARATORS, "");
  return file === folder || file.startsWith(`${folder}${PATH_SEPARATOR}`);
}

/** Every file under `dir`, sorted, minus the folders `skip` names; [] when it is no directory. */
function walk(dir, skip = () => false) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (!entry.isDirectory()) return [full];
      return skip(full) ? [] : walk(full, skip);
    });
}

/** A file's text, read once per run; null when it cannot be read, which `unreadable` reports. */
function text(project, file) {
  if (!project.texts.has(file)) {
    let content = null;
    try {
      content = fs.readFileSync(path.join(project.root, file), "utf8");
    } catch {
      // a dangling link or a folder named like a file: one problem, never a crash
    }
    project.texts.set(file, content);
  }
  return project.texts.get(file);
}

/** One problem per file a check could not read. */
const unreadable = (project) => [...project.texts].filter(([, content]) => content === null).map(([file]) => ({ file, message: UNREADABLE }));

/** A record with its file, folder under `aidd_docs/ui/`, name, front matter and sections; none when unreadable. */
function readRecord(project, file) {
  const content = text(project, file);
  if (content === null) return [];
  return [
    {
      file,
      folder: path.posix.relative(UI_DIR, path.posix.dirname(file)),
      name: path.posix.basename(file, RECORD_EXTENSION),
      ...parseRecord(content),
    },
  ];
}

/** The design system under `root`, or null when the project has none. */
function load(root) {
  const uiDir = path.join(root, UI_DIR);
  if (!fs.existsSync(uiDir) || !fs.statSync(uiDir).isDirectory()) return null;
  const showcase = path.join(uiDir, SHOWCASE_DIR);
  const files = walk(uiDir, (dir) => dir === showcase).map((file) => relative(root, file));
  const project = { root, texts: new Map(), tokensFile: `${UI_DIR}/${TOKENS_FILE}` };
  project.records = files.filter((file) => file.endsWith(RECORD_EXTENSION)).flatMap((file) => readRecord(project, file));
  project.renders = files.filter((file) => file.endsWith(RENDER_EXTENSION));
  return project;
}

module.exports = { load, walk, text, unreadable, relative, isUnder, UI_DIR, RENDER_EXTENSION };
