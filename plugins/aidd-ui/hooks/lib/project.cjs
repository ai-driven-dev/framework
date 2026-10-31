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
const ERROR = "error"; // blocks the end of a turn
const WARNING = "warning"; // informs, never blocks

const TRAILING_SEPARATORS = /\/+$/;
const BYTE_ORDER_MARK = /^﻿/;
const WINDOWS_LINE_ENDING = /\r\n/g;

/** A path relative to the project root, with forward slashes on every platform. */
const relative = (root, file) => path.relative(root, file).split(path.sep).join(PATH_SEPARATOR);

/** Whether `file` is `prefix` or lies under it, both relative to the project root. */
function isUnder(file, prefix) {
  const folder = prefix.replace(TRAILING_SEPARATORS, "");
  return file === folder || file.startsWith(`${folder}${PATH_SEPARATOR}`);
}

/** Every file under `dir`, sorted, minus the folders `skip` names; [] when it is no directory.
 * A folder that cannot be listed goes to `unlisted`, never a crash. */
function walk(dir, skip = () => false, unlisted = () => {}) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    unlisted(dir);
    return [];
  }
  return entries
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (!entry.isDirectory()) return [full];
      return skip(full) ? [] : walk(full, skip, unlisted);
    });
}

/** A file's text, read once per run, without a byte order mark and with `\n` line ends, as
 * Windows editors may write otherwise; null when it cannot be read, which `unreadable` reports. */
function text(project, file) {
  if (!project.texts.has(file)) {
    let content = null;
    try {
      content = fs.readFileSync(path.join(project.root, file), "utf8").replace(BYTE_ORDER_MARK, "").replace(WINDOWS_LINE_ENDING, "\n");
    } catch {
      // a dangling link or a folder named like a file: one problem, never a crash
    }
    project.texts.set(file, content);
  }
  return project.texts.get(file);
}

/** A check that runs each rule of `rules`, an object keyed by rule id, through `run`: every
 * problem carries its rule, and is an error unless the rule says it is a warning. */
const checkOf = (rules, run = (find, project) => find(project)) => (project) =>
  Object.entries(rules).flatMap(([rule, find]) => run(find, project).map((problem) => ({ rule, severity: ERROR, ...problem })));

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
  const project = { root, texts: new Map(), tokensFile: `${UI_DIR}/${TOKENS_FILE}` };
  const unlisted = (dir) => project.texts.set(relative(root, dir), null);
  const files = walk(uiDir, (dir) => dir === showcase, unlisted).map((file) => relative(root, file));
  project.records = files.filter((file) => file.endsWith(RECORD_EXTENSION)).flatMap((file) => readRecord(project, file));
  project.renders = files.filter((file) => file.endsWith(RENDER_EXTENSION));
  return project;
}

module.exports = { load, walk, text, unreadable, relative, isUnder, checkOf, UI_DIR, RENDER_EXTENSION, ERROR, WARNING };
