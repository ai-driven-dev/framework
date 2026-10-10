"use strict";

// Pure JSONC edit and read-only project selection. Publication belongs to the rule writer.
const fs = require("node:fs");
const path = require("node:path");
const { TextDecoder } = require("node:util");

const CONFIG_PATHS = [".kilo/kilo.json", ".kilo/kilo.jsonc", "kilo.json", "kilo.jsonc"];
const DEFAULT_CONFIG = ".kilo/kilo.jsonc";
const fail = (message) => { throw new Error(message); };

function checkInstructionPath(value) {
  if (typeof value !== "string" || !/^\.kilo\/rules\/[0-9]{2}-[a-z0-9-]+\/[0-9]-[a-z0-9]+(?:[-@.][a-z0-9]+)*\.md$/.test(value)) {
    fail("Expected an exact relative .kilo/rules/<category>/<slug>.md path.");
  }
}

function parseJsonc(text) {
  if (typeof text !== "string" || text.includes("\0")) fail("Invalid JSONC text.");
  let pos = 0;
  function skip() {
    while (pos < text.length) {
      if (/[ \t\r\n]/.test(text[pos])) { pos++; continue; }
      if (text.startsWith("//", pos)) {
        pos += 2;
        while (pos < text.length && text[pos] !== "\n") pos++;
        continue;
      }
      if (text.startsWith("/*", pos)) {
        const end = text.indexOf("*/", pos + 2);
        if (end < 0) fail("Unclosed JSONC comment.");
        pos = end + 2;
        continue;
      }
      break;
    }
  }
  function string() {
    const start = pos;
    pos++;
    while (pos < text.length) {
      if (text[pos] === "\\") { pos += 2; continue; }
      if (text[pos++] === '"') {
        const raw = text.slice(start, pos);
        try { return { type: "string", value: JSON.parse(raw), start, end: pos }; }
        catch { fail("Invalid JSONC string."); }
      }
    }
    fail("Unclosed JSONC string.");
  }
  function value() {
    skip();
    const start = pos;
    if (text[pos] === '"') return string();
    if (text[pos] === "[") {
      pos++;
      const items = [];
      let trailingComma = false;
      let lastCommaEnd = null;
      skip();
      while (text[pos] !== "]") {
        if (pos >= text.length) fail("Unclosed JSONC array.");
        items.push(value());
        skip();
        if (text[pos] === ",") {
          pos++;
          trailingComma = true;
          lastCommaEnd = pos;
          skip();
        } else if (text[pos] === "]") trailingComma = false;
        else fail("Expected comma in JSONC array.");
      }
      const close = pos++;
      return { type: "array", start, end: pos, close, items, trailingComma, lastCommaEnd };
    }
    if (text[pos] === "{") {
      pos++;
      const properties = [];
      let trailingComma = false;
      let lastCommaEnd = null;
      skip();
      while (text[pos] !== "}") {
        if (pos >= text.length) fail("Unclosed JSONC object.");
        if (text[pos] !== '"') fail("Expected JSONC property name.");
        const key = string();
        skip();
        if (text[pos++] !== ":") fail("Expected JSONC colon.");
        const entry = value();
        properties.push({ key: key.value, value: entry });
        skip();
        if (text[pos] === ",") {
          pos++;
          trailingComma = true;
          lastCommaEnd = pos;
          skip();
        } else if (text[pos] === "}") trailingComma = false;
        else fail("Expected comma in JSONC object.");
      }
      const close = pos++;
      return { type: "object", start, end: pos, close, properties, trailingComma, lastCommaEnd };
    }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(pos));
    if (!match) fail("Invalid JSONC value.");
    pos += match[0].length;
    if (pos < text.length && !/[ \t\r\n,}\]/]/.test(text[pos]) && !text.startsWith("//", pos) && !text.startsWith("/*", pos)) {
      fail("Invalid JSONC value boundary.");
    }
    return { type: "scalar", start, end: pos };
  }
  const root = value();
  skip();
  if (pos !== text.length || root.type !== "object") fail("Expected one JSONC object.");
  const fields = root.properties.filter(({ key }) => key === "instructions");
  if (fields.length > 1) fail("Duplicate instructions keys are ambiguous.");
  const instructions = fields[0]?.value;
  if (instructions && (instructions.type !== "array" || instructions.items.some((item) => item.type !== "string"))) {
    fail("instructions must be an array of strings.");
  }
  return { root, instructions };
}

function prepareInstructionEdit(content, instructionPath) {
  checkInstructionPath(instructionPath);
  if (typeof content !== "string" || Buffer.from(content).toString("utf8") !== content) fail("Invalid UTF-8 config text.");
  const { root, instructions } = parseJsonc(content);
  if (instructions?.items.some((item) => item.value === instructionPath)) return { content, changed: false };
  const entry = JSON.stringify(instructionPath);
  let offset;
  let insertion;
  if (instructions) {
    if (!instructions.items.length) {
      offset = instructions.close;
      insertion = entry;
    } else if (instructions.trailingComma) {
      offset = instructions.lastCommaEnd;
      insertion = entry + ",";
    } else {
      offset = instructions.items.at(-1).end;
      insertion = "," + entry;
    }
  } else {
    const property = `"instructions": [${entry}]`;
    offset = root.trailingComma ? root.lastCommaEnd : root.close;
    insertion = root.properties.length && !root.trailingComma ? "," + property : property;
  }
  const updated = content.slice(0, offset) + insertion + content.slice(offset);
  parseJsonc(updated);
  return { content: updated, changed: true };
}

function inspectProject(projectRoot, instructionPath, chosenPath) {
  checkInstructionPath(instructionPath);
  const root = path.resolve(projectRoot);
  if (!fs.statSync(root).isDirectory() || fs.realpathSync(root) !== root) fail("Project must be a real directory.");
  const rootIdentity = fs.statSync(root);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const candidates = [];
  for (const relative of CONFIG_PATHS) {
    const parts = relative.split("/");
    const current = path.join(root, ...parts);
    const before = inspectPath(root, parts, relative);
    if (before === null) continue;
    let fd;
    let content;
    try {
      const flags = fs.constants.O_RDONLY | (process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
      fd = fs.openSync(current, flags);
      const opened = fs.fstatSync(fd);
      if (!opened.isFile() || !sameIdentity(opened, before.at(-1))) fail(`Config changed while opening: ${relative}`);
      const after = inspectPath(root, parts, relative);
      if (!after || fs.realpathSync(root) !== root || !sameIdentity(rootIdentity, fs.statSync(root)) || !samePath(before, after)) fail(`Config path changed while opening: ${relative}`);
      content = decoder.decode(fs.readFileSync(fd));
    } catch (error) {
      if (error.message?.startsWith("Config ")) throw error;
      fail(`Cannot safely read config: ${relative}`);
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    const { instructions } = parseJsonc(content);
    candidates.push({ path: relative, ownsInstruction: !!instructions?.items.some((item) => item.value === instructionPath) });
  }
  if (chosenPath !== undefined && chosenPath !== null && !candidates.some((item) => item.path === chosenPath)) {
    fail(`Chosen Kilo config is absent: ${chosenPath}`);
  }
  if (!candidates.length) return { candidates, selectedPath: DEFAULT_CONFIG, needsChoice: false };
  if (candidates.length === 1) return { candidates, selectedPath: candidates[0].path, needsChoice: false };
  const owners = candidates.filter((item) => item.ownsInstruction);
  if (owners.length === 1) return { candidates, selectedPath: owners[0].path, needsChoice: false };
  return { candidates, selectedPath: chosenPath || null, needsChoice: !chosenPath };
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function samePath(left, right) {
  return left.length === right.length && left.every((stat, index) => sameIdentity(stat, right[index]));
}

function inspectPath(root, parts, relative) {
  const stats = [fs.statSync(root)];
  let current = root;
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    const final = index === parts.length - 1;
    if (stat.isSymbolicLink() || (final ? !stat.isFile() : !stat.isDirectory())) {
      fail(`Symlink or invalid config path: ${relative}`);
    }
    stats.push(stat);
  }
  return stats;
}

module.exports = { inspectProject, prepareInstructionEdit };
