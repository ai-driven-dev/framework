#!/usr/bin/env node
/**
 * update_memory.cjs — Syncs <aidd_project_memory> block in AI context files.
 *
 * Scans {docsDir}/memory/ for .md files and updates the <aidd_project_memory>
 * block in each context file (CLAUDE.md, AGENTS.md, .github/copilot-instructions.md)
 * with tool-appropriate references.
 *
 * When Codex is installed, also maintains the
 * <!-- aidd:memory:codex:start --><!-- aidd:memory:codex:end --> inline block in AGENTS.md
 * with the full content of all memory files.
 *
 * Syntax:
 *   CLAUDE.md / AGENTS.md        → @{docsDir}/memory/file.md
 *   .github/copilot-instructions → [{docsDir}/memory/file.md](../{docsDir}/memory/file.md)
 *
 * Usage: node .aidd/scripts/update_memory.cjs [docsDir]
 */

const { readFileSync, writeFileSync, readdirSync, existsSync, statSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

// ── Constants ─────────────────────────────────────────────────────

const MANIFEST_PATH = '.aidd/manifest.json';
const MEMORY_SUBDIR = 'memory';
const BLOCK_OPEN = '<aidd_project_memory>';
const BLOCK_CLOSE = '</aidd_project_memory>';
const CODEX_BLOCK_OPEN = '<!-- aidd:memory:codex:start -->';
const CODEX_BLOCK_CLOSE = '<!-- aidd:memory:codex:end -->';
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

function readManifest() {
  if (!existsSync(MANIFEST_PATH)) return null;
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function isCodexInstalled(manifest) {
  return manifest?.tools?.codex !== undefined;
}

function scanMemoryFiles(docsDir) {
  const memoryDir = join(docsDir, MEMORY_SUBDIR);
  if (!existsSync(memoryDir)) return [];
  return readdirSync(memoryDir)
    .filter((f) => f.endsWith('.md') && !EXCLUDED_FILES.has(f))
    .sort()
    .map((f) => join(docsDir, MEMORY_SUBDIR, f));
}

function scanMemoryFilesRecursive(docsDir) {
  const memoryDir = join(docsDir, MEMORY_SUBDIR);
  if (!existsSync(memoryDir)) return [];
  const results = [];
  collectMdFiles(memoryDir, results);
  return results.sort();
}

function collectMdFiles(dir, results) {
  const entries = readdirSync(dir);
  for (const entry of entries.sort()) {
    if (EXCLUDED_FILES.has(entry)) continue;
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      collectMdFiles(fullPath, results);
    } else if (entry.endsWith('.md')) {
      results.push(fullPath);
    }
  }
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

function updateBlock(content, blockOpen, blockClose, innerContent) {
  const openIdx = content.indexOf(blockOpen);
  const closeIdx = content.indexOf(blockClose);
  if (openIdx === -1 || closeIdx === -1 || closeIdx < openIdx) return null;
  return (
    content.slice(0, openIdx + blockOpen.length) +
    innerContent +
    content.slice(closeIdx)
  );
}

function buildCodexInlineContent(memoryFiles) {
  if (memoryFiles.length === 0) return '';
  const parts = memoryFiles.map((filePath) => {
    const relPath = filePath.replace(/\\/g, '/');
    const fileContent = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
    return `# ${relPath}\n\n${fileContent.trimEnd()}`;
  });
  return '\n' + parts.join('\n\n') + '\n';
}

function ensureCodexBlock(content) {
  const marker = `${CODEX_BLOCK_OPEN}\n${CODEX_BLOCK_CLOSE}`;
  if (content.includes(CODEX_BLOCK_OPEN)) return content;
  const separator = content.endsWith('\n') ? '' : '\n';
  return `${content}${separator}${marker}\n`;
}

function applyCodexBlock(content, docsDir) {
  const allMemoryFiles = scanMemoryFilesRecursive(docsDir);
  const withMarkers = ensureCodexBlock(content);
  const innerContent = buildCodexInlineContent(allMemoryFiles);
  return updateBlock(withMarkers, CODEX_BLOCK_OPEN, CODEX_BLOCK_CLOSE, innerContent) ?? withMarkers;
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

const manifest = readManifest();
const codexInstalled = isCodexInstalled(manifest);
const memoryFiles = scanMemoryFiles(docsDir);
const changed = [];

for (const target of TARGET_FILES) {
  if (!existsSync(target.path)) continue;

  const original = readFileSync(target.path, 'utf8');
  const innerContent = buildBlockContent(memoryFiles, target.syntax, docsDir);
  let updated = updateBlock(original, BLOCK_OPEN, BLOCK_CLOSE, innerContent);
  if (updated === null) updated = original;

  if (target.path === 'AGENTS.md' && codexInstalled) {
    updated = applyCodexBlock(updated, docsDir);
  }

  if (updated === original) continue;

  writeFileSync(target.path, updated, 'utf8');
  changed.push(target.path);
}

if (changed.length > 0) gitAdd(changed);
