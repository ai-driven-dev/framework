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

function readDocsDir(fs, argDocsDir) {
  if (argDocsDir) return argDocsDir;
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    return manifest.docsDir ?? null;
  } catch {
    return null;
  }
}

function scanMemoryFiles(fs, path, docsDir) {
  const memoryDir = path.join(docsDir, MEMORY_SUBDIR);
  if (!fs.existsSync(memoryDir)) return [];
  return fs.readdirSync(memoryDir)
    .filter((f) => f.endsWith('.md') && !EXCLUDED_FILES.has(f))
    .sort()
    .map((f) => path.join(docsDir, MEMORY_SUBDIR, f));
}

function buildReference(syntax, filePath) {
  const relativePath = filePath.replace(/\\/g, '/');
  if (syntax === 'link') {
    return `[${relativePath}](../${relativePath})`;
  }
  return `@${relativePath}`;
}

function buildBlockContent(memoryFiles, syntax) {
  if (memoryFiles.length === 0) return '';
  const refs = memoryFiles.map((f) => buildReference(syntax, f));
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

function gitAdd(childProcess, files) {
  try {
    childProcess.execSync(`git add ${files.map((f) => `"${f}"`).join(' ')}`, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    // silent — no git or not a repo
  }
}

// ── Main ──────────────────────────────────────────────────────────

(async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const childProcess = await import('node:child_process');

  const docsDir = readDocsDir(fs, process.argv[2]);
  if (!docsDir) process.exit(0);

  const memoryFiles = scanMemoryFiles(fs, path, docsDir);
  const changed = [];

  for (const target of TARGET_FILES) {
    if (!fs.existsSync(target.path)) continue;

    const original = fs.readFileSync(target.path, 'utf8');
    const innerContent = buildBlockContent(memoryFiles, target.syntax);
    const updated = updateBlock(original, innerContent);

    if (updated === null || updated === original) continue;

    fs.writeFileSync(target.path, updated, 'utf8');
    changed.push(target.path);
  }

  if (changed.length > 0) gitAdd(childProcess, changed);
})();
