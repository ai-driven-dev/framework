// One read of a project's design system, shared by every check.
const fs = require("node:fs");
const path = require("node:path");
const { parseRecord, table, LINE_BREAK } = require("./markdown.cjs");

const UI_DIR = "aidd_docs/ui";
const SYSTEM_FILE = "system.md";
const TOKENS_FILE = "tokens.json";
const RESOLVER_FILE = "tokens.resolver.json";
const CSS_FILE = "tokens.css";
const HISTORY_FILE = `${UI_DIR}/history.md`; // the engine's: one row per version of each record, no record itself
const CODE_DEBT_FILE = `${UI_DIR}/code-debt.json`; // the colour literals the code held when the system started, by file
const SHOWCASE_DIR = "showcase";
const RECORD_EXTENSION = ".md";
const RENDER_EXTENSION = ".html";
const PATH_SEPARATOR = "/";
const UNREADABLE = "unreadable";
const ENGINE_REF = "<engine>"; // where a fix names the engine: the reader knows the path from the skill that points here
const ERROR = "error"; // blocks the end of a turn
const WARNING = "warning"; // informs, never blocks

const TRAILING_SEPARATORS = /\/+$/;
const BYTE_ORDER_MARK = /^﻿/;
const WINDOWS_LINE_ENDING = /\r\n/g;

/** A request the engine declines, with the reason, before it writes anything. */
class Refusal extends Error {}

const NO_DESIGN_SYSTEM = `no design system under ${UI_DIR}`;

/** A path relative to the project root, with forward slashes on every platform. */
const relative = (root, file) => path.relative(root, file).split(path.sep).join(PATH_SEPARATOR);

/** `path` without the separators ending it. */
const withoutTrailingSeparators = (path) => path.replace(TRAILING_SEPARATORS, "");

/** The project-relative path of `name`, a file beside tokens.json. */
const besideTokens = (project, name) => path.posix.join(path.posix.dirname(project.tokensFile), name);

/** Whether `file` is `prefix` or lies under it, both relative to the project root. */
function isUnder(file, prefix) {
  const folder = withoutTrailingSeparators(prefix);
  return file === folder || file.startsWith(`${folder}${PATH_SEPARATOR}`);
}

/** Every file under `dir`, sorted, minus the folders `skip` names; [] when it is no directory.
 * A folder that cannot be listed goes to `unlisted`, never a crash. */
function walk(dir, skip = () => false, unlisted = () => {}) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    unlisted(dir);
    return [];
  }
  return entries
    .sort((a, b) => (a.name < b.name ? -1 : 1)) // by code unit, the same order on every machine
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (!entry.isDirectory()) return [full];
      return skip(full) ? [] : walk(full, skip, unlisted);
    });
}

/** A text without a byte order mark and with `\n` line ends, as Windows editors may write otherwise. */
const clean = (content) => content.replace(BYTE_ORDER_MARK, "").replace(WINDOWS_LINE_ENDING, LINE_BREAK);

/** A file's text, read once per run, cleaned; null when it cannot be read, which `unreadable`
 * reports. */
function text(project, file) {
  if (!project.texts.has(file)) {
    let content = null;
    try {
      content = clean(fs.readFileSync(path.join(project.root, file), "utf8"));
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
const unreadable = (project) =>
  [...project.texts].filter(([, content]) => content === null).map(([file]) => ({ rule: "U1", severity: ERROR, file, message: UNREADABLE, fix: "make it readable, or remove it" }));

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
  project.records = files.filter((file) => file.endsWith(RECORD_EXTENSION) && file !== HISTORY_FILE).flatMap((file) => readRecord(project, file));
  project.history = files.includes(HISTORY_FILE) ? table({ lines: (text(project, HISTORY_FILE) ?? "").split(LINE_BREAK) }) : [];
  project.renders = files.filter((file) => file.endsWith(RENDER_EXTENSION));
  return project;
}

module.exports = { Refusal, NO_DESIGN_SYSTEM, load, walk, text, clean, unreadable, relative, isUnder, withoutTrailingSeparators, besideTokens, checkOf, UI_DIR, SYSTEM_FILE, TOKENS_FILE, RESOLVER_FILE, CSS_FILE, HISTORY_FILE, CODE_DEBT_FILE, RENDER_EXTENSION, ERROR, WARNING, ENGINE_REF };
