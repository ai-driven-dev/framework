#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { argv, cwd, exit, stderr, stdout } from "node:process";

function parseArgs(args) {
  let root = cwd();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root" && args[i + 1]) {
      root = resolve(args[i + 1]);
      i++;
    }
  }
  return { root };
}

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile() && e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

function extractFrontmatter(content) {
  if (!content.startsWith("---")) return null;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return null;
  return content.slice(4, end).replace(/^\n/, "");
}

function stripInlineComment(s) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "#" && !inSingle && !inDouble && (i === 0 || /\s/.test(s[i - 1]))) {
      return s.slice(0, i).trimEnd();
    }
  }
  return s;
}

function parseFrontmatter(raw) {
  const fm = {};
  const lines = raw.split("\n");
  let currentKey = null;
  let listAcc = null;

  for (const rawLine of lines) {
    const line = stripInlineComment(rawLine);
    if (!line.trim()) continue;

    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem && currentKey && listAcc) {
      listAcc.push(stripQuotes(listItem[1].trim()));
      continue;
    }

    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (kv) {
      const [, key, rawValue] = kv;
      const value = rawValue.trim();
      if (value === "") {
        currentKey = key;
        listAcc = [];
        fm[key] = listAcc;
      } else {
        fm[key] = stripQuotes(value);
        currentKey = null;
        listAcc = null;
      }
    }
  }

  return fm;
}

function stripQuotes(v) {
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

async function main() {
  const { root } = parseArgs(argv.slice(2));
  const rulesDir = join(root, "aidd_docs", "rules");

  if (!existsSync(rulesDir)) {
    stdout.write("[]\n");
    exit(0);
  }

  const dirStat = await stat(rulesDir);
  if (!dirStat.isDirectory()) {
    stdout.write("[]\n");
    exit(0);
  }

  const files = await walk(rulesDir);
  const out = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");
    const raw = extractFrontmatter(content);
    if (!raw) {
      stderr.write(`skip (no frontmatter): ${relative(root, file)}\n`);
      continue;
    }
    const fm = parseFrontmatter(raw);
    if (!fm.name || !fm.description) {
      stderr.write(`skip (missing name or description): ${relative(root, file)}\n`);
      continue;
    }
    const entry = {
      path: relative(root, file),
      name: fm.name,
      description: fm.description,
    };
    if (Array.isArray(fm.paths) && fm.paths.length > 0) entry.paths = fm.paths;
    out.push(entry);
  }

  stdout.write(JSON.stringify(out, null, 2) + "\n");
}

main().catch((err) => {
  stderr.write(`error: ${err.message}\n`);
  exit(1);
});
