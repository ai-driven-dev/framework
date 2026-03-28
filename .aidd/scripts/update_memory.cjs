#!/usr/bin/env node
/**
 * update_memory.js — Syncs <aidd_project_memory> block in AI context files.
 *
 * Scans {docsDir}/memory/ for .md files and updates the <aidd_project_memory>
 * block in each context file (CLAUDE.md, AGENTS.md, .github/copilot-instructions.md)
 * with tool-appropriate references.
 *
 * Syntax:
 *   CLAUDE.md / AGENTS.md        → @{docsDir}/memory/file.md
 *   .github/copilot-instructions → [{docsDir}/memory/file.md](../{docsDir}/memory/file.md)
 *
 * Usage: node .aidd/scripts/update_memory.js [docsDir]
 */

const { readFileSync, writeFileSync, readdirSync, existsSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

// ── Constants ─────────────────────────────────────────────────────

const MANIFEST_PATH = '.aidd/manifest.json';
const MEMORY_SUBDIR = 'memory';
const BLOCK_OPEN = '<aidd_project_memory>';
const BLOCK_CLOSE = '</aidd_project_memory>';
const EXCLUDED_FILES = new Set(['.gitkeep']);

const TARGET_FILES = [
  { path: 'CLAUDE.md', syntax: 'at' },
  { path: 'AGENTS.md', syntax: 'at' },
  { path: '.github/copilot-instructions.md', syntax: 'link' },
];

// ── Helpers ───────────────────────────────────────────────────────

function readDocsDir() {
  const argDocsDir = process.argv[2];
  if (argDocsDir) return argDocsDir;
  if (!existsSync(MANIFEST_PATH)) return null;
  try {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    return manifest.docsDir ?? null;
  } catch {
    return null;
  }
}

function scanMemoryFiles(docsDir) {
  const memoryDir = join(docsDir, MEMORY_SUBDIR);
  if (!existsSync(memoryDir)) return [];
  return readdirSync(memoryDir)
    .filter((f) => f.endsWith('.md') && !EXCLUDED_FILES.has(f))
    .sort()
    .map((f) => join(docsDir, MEMORY_SUBDIR, f));
}

function buildReference(syntax, docsDir, filePath) {
  const relativePath = filePath.replace(/\\/g, '/');
  if (syntax === 'link') {
    return `[${relativePath}](../${relativePath})`;
  }
  return `@${relativePath}`;
}

function buildBlockContent(memoryFiles, syntax, docsDir) {
  if (memoryFiles.length === 0) return '';
  const refs = memoryFiles.map((f) => buildReference(syntax, docsDir, f));
  return '\n' + refs.join('\n') + '\n';
}

function updateBlock(content, innerContent) {
  const openIdx = content.indexOf(BLOCK_OPEN);
  const closeIdx = content.indexOf(BLOCK_CLOSE);
  if (openIdx === -1 || closeIdx === -1 || closeIdx < openIdx) return null;
  return (
    content.slice(0, openIdx + BLOCK_OPEN.length) +
    innerContent +
    content.slice(closeIdx)
  );
}

function gitAdd(files) {
  try {
    execSync(`git add ${files.map((f) => `"${f}"`).join(' ')}`, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    // silent — no git or not a repo
  }
}

// ── Main ──────────────────────────────────────────────────────────

const docsDir = readDocsDir();
if (!docsDir) process.exit(0);

const memoryFiles = scanMemoryFiles(docsDir);
const changed = [];

for (const target of TARGET_FILES) {
  if (!existsSync(target.path)) continue;

  const original = readFileSync(target.path, 'utf8');
  const innerContent = buildBlockContent(memoryFiles, target.syntax, docsDir);
  const updated = updateBlock(original, innerContent);

  if (updated === null || updated === original) continue;

  writeFileSync(target.path, updated, 'utf8');
  changed.push(target.path);
}

if (changed.length > 0) gitAdd(changed);
